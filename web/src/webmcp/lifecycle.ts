import type { WorkspaceReader } from "../projections/workspace-reader";
import type { WebMcpCommandAdapter } from "../adapters/webmcp-command-adapter";
import type { AgentActivityListener } from "./activity";
import { detectModelContext, type WebMcpDocument, type WebMcpModelContext } from "./runtime";
import { createWebMcpTools } from "./tools";

export type WebMcpRegistrationState =
  | { status: "unsupported" }
  | { status: "registered"; toolNames: readonly string[] }
  | { status: "failed"; message: string };

type RuntimeResolver = () => WebMcpModelContext | null;
type WebMcpRegistrationOutcome = WebMcpRegistrationState | null;

export interface WebMcpRegistrationOptions {
  commandAdapter?: WebMcpCommandAdapter;
  onWorkspaceChanged?: (stateVersion: number) => void;
  onWorkspaceSyncError?: (error: unknown, stateVersion: number) => void;
  onAgentActivity?: AgentActivityListener;
}

export class WebMcpRegistrationManager {
  private activeController: AbortController | null = null;
  private generation = 0;
  private lastCommittedProposalOperationId: string | null = null;

  constructor(
    private readonly resolveRuntime: RuntimeResolver = () => detectModelContext(),
  ) {}

  /**
   * Replace the whole catalogue for the current page state. The previous registration is aborted
   * first so cached invocations fail closed with STALE_REGISTRATION. Which tools appear is decided
   * by the bounded projection (phase, lifecycle, proposal availability), never by this class.
   */
  async replace(
    reader: WorkspaceReader,
    options: Readonly<WebMcpRegistrationOptions> = {},
  ): Promise<WebMcpRegistrationOutcome> {
    const generation = ++this.generation;
    this.abortActive();
    const runtime = this.resolveRuntime();
    if (!runtime) return { status: "unsupported" };

    const controller = new AbortController();
    this.activeController = controller;
    const tools = createWebMcpTools(reader, controller.signal, {
      ...options,
      onProposalCommitted: (operationId) => {
        this.lastCommittedProposalOperationId = operationId;
      },
    });

    try {
      await Promise.all(
        tools.map((tool) => runtime.registerTool(tool, { signal: controller.signal })),
      );
      if (!this.isCurrent(generation, controller)) return null;
      return { status: "registered", toolNames: tools.map((tool) => tool.name) };
    } catch (error) {
      if (!this.isCurrent(generation, controller)) return null;
      controller.abort();
      this.activeController = null;
      return {
        status: "failed",
        message: error instanceof Error ? error.message : "WebMCP registration failed.",
      };
    }
  }

  /** The operation id of the most recent proposal this page committed, for diagnostics only. */
  lastProposalOperationId(): string | null {
    return this.lastCommittedProposalOperationId;
  }

  stop(): void {
    this.generation += 1;
    this.abortActive();
  }

  private abortActive(): void {
    this.activeController?.abort();
    this.activeController = null;
  }

  private isCurrent(generation: number, controller: AbortController): boolean {
    return this.generation === generation &&
      this.activeController === controller &&
      !controller.signal.aborted;
  }
}

export function runtimeResolverFor(documentLike: WebMcpDocument): RuntimeResolver {
  return () => detectModelContext(documentLike);
}
