import type { WorkspaceReader } from "../projections/workspace-reader";
import type { WebMcpCommandAdapter } from "../adapters/webmcp-command-adapter";
import { detectModelContext, type WebMcpDocument, type WebMcpModelContext } from "./runtime";
import { createWebMcpTools } from "./tools";

export type WebMcpRegistrationState =
  | { status: "unsupported" }
  | { status: "registered"; toolNames: readonly string[] }
  | { status: "failed"; message: string };

type RuntimeResolver = () => WebMcpModelContext | null;
type WebMcpRegistrationOutcome = WebMcpRegistrationState | null;

export class WebMcpRegistrationManager {
  private activeController: AbortController | null = null;
  private generation = 0;

  constructor(
    private readonly resolveRuntime: RuntimeResolver = () => detectModelContext(),
  ) {}

  async replace(
    reader: WorkspaceReader,
    options: Readonly<{
      commandAdapter?: WebMcpCommandAdapter;
      onWorkspaceChanged?: (stateVersion: number) => void;
    }> = {},
  ): Promise<WebMcpRegistrationOutcome> {
    const generation = ++this.generation;
    this.abortActive();
    const runtime = this.resolveRuntime();
    if (!runtime) return { status: "unsupported" };

    const controller = new AbortController();
    this.activeController = controller;
    const tools = createWebMcpTools(reader, controller.signal, options);

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
