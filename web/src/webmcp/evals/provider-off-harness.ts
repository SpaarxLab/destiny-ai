import { createParticipantCommandAdapter } from "../../adapters/participant-command-adapter";
import { createWebMcpCommandAdapter } from "../../adapters/webmcp-command-adapter";
import { CommandKernel, type CommandEnvironment } from "../../commands/command-kernel";
import { workspaceSchema, type Workspace } from "../../domain/workspace";
import { WorkspaceReader } from "../../projections/workspace-reader";
import { WorkspaceStoreError, type WorkspaceStore } from "../../storage/workspace-store";
import type { AgentActivityEvent } from "../activity";
import { WebMcpRegistrationManager } from "../lifecycle";
import { FakeWebMcpRuntime } from "../testing/fake-runtime";

export class MutableEvalWorkspaceStore implements WorkspaceStore {
  private workspace: Workspace;

  constructor(workspace: Workspace) {
    this.workspace = workspaceSchema.parse(workspace);
  }

  load(): Workspace {
    return workspaceSchema.parse(this.workspace);
  }

  save(expectedVersion: number, nextWorkspace: Workspace): void {
    if (this.workspace.stateVersion !== expectedVersion) {
      throw new WorkspaceStoreError(
        "STALE_WRITE",
        `Eval store expected version ${expectedVersion}.`,
        this.workspace.stateVersion,
      );
    }
    this.workspace = workspaceSchema.parse(nextWorkspace);
  }

  replace(workspace: Workspace): void {
    this.workspace = workspaceSchema.parse(workspace);
  }
}

function deterministicEnvironment(): CommandEnvironment {
  let id = 900;
  return {
    now: () => "2026-09-01T10:00:00.000Z",
    createId: () => `00000000-0000-4000-8000-${String(id++).padStart(12, "0")}`,
  };
}

export function createProviderOffEvalContext(workspace: Workspace) {
  const store = new MutableEvalWorkspaceStore(workspace);
  const kernel = new CommandKernel(store, deterministicEnvironment());
  const reader = new WorkspaceReader(store);
  const webMcpAdapter = createWebMcpCommandAdapter(kernel);
  const participantAdapter = createParticipantCommandAdapter(kernel);
  const runtime = new FakeWebMcpRuntime();
  const manager = new WebMcpRegistrationManager(() => runtime);
  const visibleVersions: number[] = [];
  const activity: AgentActivityEvent[] = [];

  return {
    store,
    kernel,
    reader,
    webMcpAdapter,
    participantAdapter,
    runtime,
    manager,
    visibleVersions,
    activity,
    discover: () => manager.replace(reader, {
      commandAdapter: webMcpAdapter,
      onWorkspaceChanged: (stateVersion) => visibleVersions.push(stateVersion),
      onAgentActivity: (event) => activity.push(event),
    }),
    /** Discovery metadata exactly as a visiting agent sees it: name, description, input schema. */
    catalogue: () => runtime.activeTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
    /** Invoke only a currently discovered tool, as a policy that respects the live catalogue would. */
    invokeDiscovered: async (name: string, input: unknown) => {
      if (!runtime.activeToolNames().includes(name)) {
        throw new Error(`Tool ${name} is not discoverable in the current catalogue.`);
      }
      return runtime.invoke(name, input);
    },
    /** Participant-authority command through the same kernel, for round-trip evals. */
    participant: (command: unknown) =>
      kernel.execute({ actor: "participant", proposalSource: "participant" }, command),
  };
}

export async function invokeOnlyIfAvailable(
  runtime: FakeWebMcpRuntime,
  toolName: string,
  input: unknown,
): Promise<{ invoked: boolean; result?: unknown }> {
  if (!runtime.activeToolNames().includes(toolName)) return { invoked: false };
  return { invoked: true, result: await runtime.invoke(toolName, input) };
}
