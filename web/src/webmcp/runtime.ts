export type JsonSchema = Readonly<Record<string, unknown>>;

export interface WebMcpToolDefinition {
  name: string;
  /** Display name the host shows when it references the tool (spec: ModelContextTool.title). */
  title?: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: Readonly<{
    readOnlyHint: boolean;
    untrustedContentHint?: boolean;
    /** Proposed in webmachinelearning/webmcp#217; read by Chrome's tool inspector. Marks calls that stake something. */
    consequentialHint?: boolean;
  }>;
  execute(input: unknown): unknown | Promise<unknown>;
}

export interface WebMcpRegisteredTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: JsonSchema;
  annotations?: WebMcpToolDefinition["annotations"];
}

export interface WebMcpModelContext {
  registerTool(
    tool: WebMcpToolDefinition,
    options: Readonly<{ signal: AbortSignal }>,
  ): Promise<void>;
  getTools?(options?: Readonly<{ fromOrigins?: readonly string[] }>): Promise<readonly WebMcpRegisteredTool[]> | readonly WebMcpRegisteredTool[];
  executeTool?(tool: string, input: string, options?: unknown): Promise<string>;
  addEventListener?(type: "toolchange", listener: () => void): void;
  removeEventListener?(type: "toolchange", listener: () => void): void;
  ontoolchange?: (() => void) | null;
}

export interface WebMcpDocument {
  modelContext?: WebMcpModelContext;
}

/**
 * Subscribe to catalogue changes without assuming a host's WebMCP object is extensible.
 * Some hosts expose an EventTarget-like, frozen modelContext; mutating its legacy
 * `ontoolchange` slot crashes the page before the catalogue can render.
 */
export function subscribeToToolChanges(context: WebMcpModelContext, listener: () => void): () => void {
  if (context.addEventListener && context.removeEventListener) {
    context.addEventListener("toolchange", listener);
    return () => context.removeEventListener?.("toolchange", listener);
  }

  try {
    const previous = context.ontoolchange ?? null;
    context.ontoolchange = listener;
    return () => {
      if (context.ontoolchange === listener) context.ontoolchange = previous;
    };
  } catch {
    // A read-only host can still register and execute tools; it simply cannot
    // notify this optional visualisation about later catalogue changes.
    return () => undefined;
  }
}

/**
 * Extensions and hosts attach `document.modelContext` late. Polls for it (every `every` ms up to `timeoutMs`), resolving
 * null when nothing appears. Mirrors the retry loop in Chrome's use-webmcp-tool hook.
 */
export async function waitForModelContext(timeoutMs = 10_000, every = 500): Promise<WebMcpModelContext | null> {
  const started = Date.now();
  for (;;) {
    const found = detectModelContext();
    if (found) return found;
    if (Date.now() - started >= timeoutMs) return null;
    await new Promise((resolve) => setTimeout(resolve, every));
  }
}

export function detectModelContext(
  candidate: WebMcpDocument | undefined =
    typeof document === "undefined" ? undefined : (document as unknown as WebMcpDocument),
): WebMcpModelContext | null {
  const modelContext = candidate?.modelContext;
  return modelContext && typeof modelContext.registerTool === "function" ? modelContext : null;
}
