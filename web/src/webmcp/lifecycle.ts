import type { WorkspaceReader } from "../projections/workspace-reader";
import { detectModelContext, type WebMcpDocument, type WebMcpModelContext } from "./runtime";
import { createWebMcpTools } from "./tools";

export type WebMcpRegistrationState =
  | { status: "unsupported" }
  | { status: "registered"; toolNames: readonly string[] }
  | { status: "failed"; message: string };

type RuntimeResolver = () => WebMcpModelContext | null;

export class WebMcpRegistrationManager {
  private activeController: AbortController | null = null;

  constructor(
    private readonly resolveRuntime: RuntimeResolver = () => detectModelContext(),
  ) {}

  replace(reader: WorkspaceReader): WebMcpRegistrationState {
    this.stop();
    const runtime = this.resolveRuntime();
    if (!runtime) return { status: "unsupported" };

    const controller = new AbortController();
    this.activeController = controller;
    const tools = createWebMcpTools(reader, controller.signal);

    try {
      for (const tool of tools) {
        runtime.registerTool(tool, { signal: controller.signal });
      }
      return { status: "registered", toolNames: tools.map((tool) => tool.name) };
    } catch (error) {
      controller.abort();
      this.activeController = null;
      return {
        status: "failed",
        message: error instanceof Error ? error.message : "WebMCP registration failed.",
      };
    }
  }

  stop(): void {
    this.activeController?.abort();
    this.activeController = null;
  }
}

export function runtimeResolverFor(documentLike: WebMcpDocument): RuntimeResolver {
  return () => detectModelContext(documentLike);
}
