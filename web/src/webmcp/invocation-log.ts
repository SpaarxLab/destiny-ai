import type { WebMcpToolDefinition } from "./runtime";

export type WebMcpInvocationStatus =
  | "running"
  | "completed"
  | "awaiting_participant"
  | "denied"
  | "replay"
  | "recovery";

export interface WebMcpInvocationEvent {
  id: string;
  tool: string;
  startedAt: string;
  completedAt?: string;
  status: WebMcpInvocationStatus;
  request: unknown;
  response?: unknown;
  expectedVersion?: number;
  stateVersion?: number;
  durationMs?: number;
  receiptRef?: string;
  changedRefs?: string[];
  persistence: "pending" | "saved" | "visual_only" | "none";
}

export type WebMcpInvocationListener = (event: WebMcpInvocationEvent) => void;

let invocationCounter = 0;

/**
 * Observes the page's existing tools without becoming a command or persistence path. The
 * listener receives an immutable running snapshot and then a terminal snapshot with the same id.
 */
export function instrumentWebMcpTools(
  tools: readonly WebMcpToolDefinition[],
  listener?: WebMcpInvocationListener,
  now: () => number = Date.now,
): readonly WebMcpToolDefinition[] {
  if (!listener) return tools;
  return tools.map((tool) => ({
    ...tool,
    async execute(input: unknown) {
      invocationCounter += 1;
      const started = now();
      const running: WebMcpInvocationEvent = {
        id: `webmcp-${started.toString(36)}-${invocationCounter}`,
        tool: tool.name,
        startedAt: new Date(started).toISOString(),
        status: "running",
        request: safeSnapshot(input),
        expectedVersion: versionFrom(input, "expectedVersion"),
        persistence: "pending",
      };
      emit(listener, running);
      try {
        const result = await tool.execute(input);
        const completed = now();
        const response = safeSnapshot(result);
        const record = asRecord(response);
        const receipt = asRecord(record?.receipt);
        const terminal: WebMcpInvocationEvent = {
          ...running,
          completedAt: new Date(completed).toISOString(),
          status: statusFrom(record),
          response,
          stateVersion: versionFrom(record, "stateVersion"),
          durationMs: Math.max(0, completed - started),
          receiptRef: stringFrom(receipt, "operationRef"),
          changedRefs: stringsFrom(receipt, "changedRefs"),
          persistence: persistenceFrom(record, receipt),
        };
        emit(listener, terminal);
        return result;
      } catch (error) {
        const completed = now();
        emit(listener, {
          ...running,
          completedAt: new Date(completed).toISOString(),
          status: "denied",
          response: { ok: false, error: { code: "UNHANDLED_TOOL_ERROR", what: error instanceof Error ? error.message : "Tool execution failed." } },
          durationMs: Math.max(0, completed - started),
          persistence: "none",
        });
        throw error;
      }
    },
  }));
}

function statusFrom(result: Record<string, unknown> | null): WebMcpInvocationStatus {
  if (!result || result.ok === false) return result?.outcome === "recovery" ? "recovery" : "denied";
  if (result.outcome === "awaiting_participant") return "awaiting_participant";
  if (result.outcome === "replay") return "replay";
  if (result.outcome === "recovery") return "recovery";
  return "completed";
}

function persistenceFrom(result: Record<string, unknown> | null, receipt: Record<string, unknown> | null): WebMcpInvocationEvent["persistence"] {
  const data = asRecord(result?.data);
  if (data?.persistentMutation === false) return "visual_only";
  if (receipt) return "saved";
  return "none";
}

function safeSnapshot(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value, (key, item) =>
      /token|secret|password|authorization|api.?key/i.test(key) ? "[redacted]" : item));
  } catch {
    return "[unserializable]";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function versionFrom(value: unknown, key: string): number | undefined {
  const candidate = asRecord(value)?.[key];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : undefined;
}

function stringFrom(value: Record<string, unknown> | null, key: string): string | undefined {
  const candidate = value?.[key];
  return typeof candidate === "string" ? candidate : undefined;
}

function stringsFrom(value: Record<string, unknown> | null, key: string): string[] | undefined {
  const candidate = value?.[key];
  return Array.isArray(candidate) && candidate.every((item) => typeof item === "string") ? candidate : undefined;
}

function emit(listener: WebMcpInvocationListener, event: WebMcpInvocationEvent): void {
  try {
    listener(event);
  } catch {
    // Observability must never change whether an authoritative tool call succeeds.
  }
}
