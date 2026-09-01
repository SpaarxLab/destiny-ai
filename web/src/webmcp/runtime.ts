export type JsonSchema = Readonly<Record<string, unknown>>;

export interface WebMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: Readonly<{
    readOnlyHint: boolean;
    untrustedContentHint?: boolean;
  }>;
  execute(input: unknown): unknown | Promise<unknown>;
}

export interface WebMcpModelContext {
  registerTool(
    tool: WebMcpToolDefinition,
    options: Readonly<{ signal: AbortSignal }>,
  ): Promise<void>;
}

export interface WebMcpDocument {
  modelContext?: WebMcpModelContext;
}

export function detectModelContext(
  candidate: WebMcpDocument | undefined =
    typeof document === "undefined" ? undefined : (document as unknown as WebMcpDocument),
): WebMcpModelContext | null {
  const modelContext = candidate?.modelContext;
  return modelContext && typeof modelContext.registerTool === "function" ? modelContext : null;
}
