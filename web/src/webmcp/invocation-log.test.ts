import { describe, expect, it } from "vitest";
import { instrumentWebMcpTools, type WebMcpInvocationEvent } from "./invocation-log";
import type { WebMcpToolDefinition } from "./runtime";

function tool(execute: WebMcpToolDefinition["execute"]): WebMcpToolDefinition {
  return { name: "stage_probe", description: "test", inputSchema: { type: "object" }, annotations: { readOnlyHint: false }, execute };
}

describe("WebMCP invocation instrumentation", () => {
  it("records request, response, timing, versions, receipt, and persistence", async () => {
    const events: WebMcpInvocationEvent[] = [];
    const clock = [1_000, 1_037];
    const [observed] = instrumentWebMcpTools([tool(async () => ({
      ok: true,
      outcome: "awaiting_participant",
      stateVersion: 4,
      receipt: { operationRef: "operation-4", changedRefs: ["card-4"] },
    }))], (event) => events.push(event), () => clock.shift()!);

    await observed.execute({ operationId: "operation-id", expectedVersion: 3, uncertainty: "ownership" });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ tool: "stage_probe", status: "running", expectedVersion: 3, persistence: "pending" });
    expect(events[1]).toMatchObject({
      id: events[0].id,
      status: "awaiting_participant",
      expectedVersion: 3,
      stateVersion: 4,
      durationMs: 37,
      receiptRef: "operation-4",
      changedRefs: ["card-4"],
      persistence: "saved",
    });
  });

  it("marks transient presentations and denials without inventing persistence", async () => {
    const events: WebMcpInvocationEvent[] = [];
    const definitions = instrumentWebMcpTools([
      tool(() => ({ ok: true, outcome: "presented", stateVersion: 2, data: { persistentMutation: false } })),
      { ...tool(() => ({ ok: false, outcome: "denied", stateVersion: 2, error: { code: "STALE_STATE" } })), name: "propose_hypothesis" },
    ], (event) => events.push(event));

    await definitions[0].execute({});
    await definitions[1].execute({ expectedVersion: 1 });

    expect(events[1]).toMatchObject({ status: "completed", persistence: "visual_only", stateVersion: 2 });
    expect(events[3]).toMatchObject({ status: "denied", persistence: "none", stateVersion: 2 });
  });

  it("redacts sensitive-looking fields and cannot let an observer break a tool", async () => {
    const [observed] = instrumentWebMcpTools([
      tool((input) => ({ ok: true, stateVersion: 0, input })),
    ], () => { throw new Error("observer failed"); });

    const result = await observed.execute({ apiKey: "do-not-log", nested: { authorization: "secret", text: "keep me" } });

    expect(result).toMatchObject({ ok: true });
  });
});
