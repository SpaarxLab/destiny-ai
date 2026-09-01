import { createParticipantCommandAdapter } from "../../adapters/participant-command-adapter";
import { createWebMcpCommandAdapter } from "../../adapters/webmcp-command-adapter";
import { CommandKernel } from "../../commands/command-kernel";
import { workspaceSchema, type Workspace } from "../../domain/workspace";
import { WorkspaceReader } from "../../projections/workspace-reader";
import { WorkspaceStoreError, type WorkspaceStore } from "../../storage/workspace-store";
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

export function createProviderOffEvalContext(workspace: Workspace) {
  const store = new MutableEvalWorkspaceStore(workspace);
  const kernel = new CommandKernel(store);
  const reader = new WorkspaceReader(store);
  const webMcpAdapter = createWebMcpCommandAdapter(kernel);
  const participantAdapter = createParticipantCommandAdapter(kernel);
  const runtime = new FakeWebMcpRuntime();
  const manager = new WebMcpRegistrationManager(() => runtime);
  const visibleVersions: number[] = [];

  return {
    store,
    reader,
    webMcpAdapter,
    participantAdapter,
    runtime,
    manager,
    visibleVersions,
    discover: () => manager.replace(reader, {
      commandAdapter: webMcpAdapter,
      onWorkspaceChanged: (stateVersion) => visibleVersions.push(stateVersion),
    }),
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
