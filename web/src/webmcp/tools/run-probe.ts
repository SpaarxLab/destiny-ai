import type { WebMcpCommandAdapter } from "../../adapters/webmcp-command-adapter";
import type { ToolResult } from "../../domain/results";
import { publicReceipt, type AgentIdentity, type Card, type Swipe, type Workspace } from "../../domain/workspace";
import type { AgentActivityListener } from "../activity";
import { denialSummary, emitActivity, STALE_REGISTRATION_SUMMARY } from "../activity";
import { staleRegistrationResult } from "../contracts";
import type { WebMcpToolDefinition } from "../runtime";

const CHATGPT: AgentIdentity = { source: "chatgpt_webmcp", role: "dealer", label: "ChatGPT" };

type ProbeInput = {
  operationId: string;
  expectedVersion: number;
  waitMs?: number;
  probe: {
    text: string;
    axis: Card["axis"];
    pole: Card["pole"];
    kind: Card["kind"];
    reasons?: [string, string, string];
    reversalOfRef?: string;
    falsifiesTensionRef?: string;
    expectedGesture?: Swipe["gesture"];
  };
};

type RunProbeOptions = Readonly<{
  loadWorkspace: () => Workspace;
  onWorkspaceChanged?: (stateVersion: number) => void;
  onWorkspaceSyncError?: (error: unknown, stateVersion: number) => void;
  onAgentActivity?: AgentActivityListener;
}>;

export const RUN_PROBE_DESCRIPTION = "Stage one visible Destiny moment, duel, reversal, or falsification probe for the participant, then wait for their response on the webpage. Use only after inspecting the room. The participant alone responds. Returns the staged receipt plus the authoritative participant response receipt, or a typed timeout, abort, denial, or recovery outcome.";

export const RUN_PROBE_INPUT_SCHEMA = {
  type: "object",
  properties: {
    operationId: { type: "string", format: "uuid" },
    expectedVersion: { type: "integer", minimum: 0 },
    waitMs: { type: "integer", minimum: 1_000, maximum: 120_000, default: 90_000 },
    probe: {
      type: "object",
      properties: {
        text: { type: "string", minLength: 20, maxLength: 140 },
        axis: { type: "string", enum: ["autonomy_belonging", "depth_breadth", "making_deciding", "visible_hidden", "stability_risk", "people_things"] },
        pole: { type: "string", enum: ["a", "b"] },
        kind: { type: "string", enum: ["moment", "duel", "reversal", "falsification"] },
        reasons: { type: "array", minItems: 3, maxItems: 3, items: { type: "string", minLength: 12, maxLength: 90 } },
        reversalOfRef: { type: "string", minLength: 1, maxLength: 128 },
        falsifiesTensionRef: { type: "string", minLength: 1, maxLength: 128 },
        expectedGesture: { type: "string", enum: ["me", "not_me", "wish", "used_to"] },
      },
      required: ["text", "axis", "pole", "kind"],
      additionalProperties: false,
    },
  },
  required: ["operationId", "expectedVersion", "probe"],
  additionalProperties: false,
} as const;

export function createRunProbeTool(adapter: WebMcpCommandAdapter, signal: AbortSignal, options: RunProbeOptions): WebMcpToolDefinition {
  return {
    name: "run_probe",
    description: RUN_PROBE_DESCRIPTION,
    inputSchema: RUN_PROBE_INPUT_SCHEMA,
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    async execute(rawInput: unknown) {
      if (signal.aborted) {
        emitActivity(options.onAgentActivity, { tool: "run_probe", outcome: "stale_registration", effect: "NONE", summary: STALE_REGISTRATION_SUMMARY, code: "STALE_REGISTRATION", stateVersion: 0 });
        return { ...staleRegistrationResult(), outcome: "aborted" };
      }

      const input = rawInput as ProbeInput;
      const staged = await adapter.dealCards({ operationId: input.operationId, expectedVersion: input.expectedVersion, role: "dealer", cards: [input.probe] }, CHATGPT);
      if (!staged.ok || !staged.data || !staged.receipt) {
        emitActivity(options.onAgentActivity, { tool: "run_probe", outcome: "denied", effect: "NONE", summary: staged.error ? denialSummary(staged.error) : "ChatGPT could not stage that probe. Nothing changed.", code: staged.error?.code, stateVersion: staged.stateVersion, changedRefs: staged.error?.changedRefs });
        return { ...staged, outcome: "denied" };
      }

      const probe = staged.data.cards[0];
      const successfulStage = staged as SuccessfulStage;
      const replayedStage = staged.guidance.startsWith("Replay detected");
      if (!replayedStage) {
        notifyWorkspaceChanged(staged.stateVersion, options.onWorkspaceChanged, options.onWorkspaceSyncError);
        emitActivity(options.onAgentActivity, { tool: "run_probe", outcome: "ok", effect: "AWAITING_HUMAN", summary: "ChatGPT staged a probe and is waiting for your response on the page.", stateVersion: staged.stateVersion, changedRefs: staged.receipt.changedRefs });
      }

      const completed = completedResponse(options.loadWorkspace(), probe.ref);
      if (completed) return completedResult(successfulStage, probe, completed, replayedStage);

      return waitForResponse(successfulStage, probe, input.waitMs ?? 90_000, signal, options, replayedStage);
    },
  };
}

function waitForResponse(staged: SuccessfulStage, probe: Card, waitMs: number, signal: AbortSignal, options: RunProbeOptions, replayedStage: boolean): Promise<unknown> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: unknown) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      resolve(value);
    };
    const check = () => {
      const workspace = options.loadWorkspace();
      const completed = completedResponse(workspace, probe.ref);
      if (!completed) return;
      emitActivity(options.onAgentActivity, { tool: "run_probe", outcome: "ok", effect: replayedStage ? "REPLAY" : "PROPOSED", summary: replayedStage ? "ChatGPT recovered the completed probe and its original receipt." : "ChatGPT received your probe response from the page.", stateVersion: workspace.stateVersion, changedRefs: [completed.swipe.ref] });
      finish(completedResult(staged, probe, completed, replayedStage));
    };
    const abort = () => {
      const workspace = options.loadWorkspace();
      finish(recoveryResult("aborted", staged, probe, workspace.stateVersion, "The WebMCP invocation disconnected. The staged probe remains on the page."));
    };
    const poll = setInterval(check, 100);
    const timeout = setTimeout(() => {
      const workspace = options.loadWorkspace();
      finish(recoveryResult("timeout", staged, probe, workspace.stateVersion, "The wait ended before the participant responded. The staged probe remains on the page."));
    }, waitMs);
    signal.addEventListener("abort", abort, { once: true });
    check();
  });
}

type SuccessfulStage = ToolResult<{ cards: Card[]; dealRef: string }> & { ok: true; data: { cards: Card[]; dealRef: string }; receipt: NonNullable<ToolResult<unknown>["receipt"]> };

function completedResponse(workspace: Workspace, cardRef: string): { swipe: Swipe; receipt: ReturnType<typeof publicReceipt> } | null {
  const swipe = workspace.swipes.find((candidate) => candidate.cardRef === cardRef);
  if (!swipe) return null;
  const operation = workspace.operations.find((candidate) => candidate.command === "swipe_card" && candidate.changedRefs.includes(swipe.ref));
  return operation ? { swipe, receipt: publicReceipt(operation) } : null;
}

function completedResult(staged: SuccessfulStage, probe: Card, completed: NonNullable<ReturnType<typeof completedResponse>>, replayed: boolean) {
  return {
    ok: true,
    outcome: replayed ? "replay" : "completed",
    data: { probeRef: probe.ref, response: { swipeRef: completed.swipe.ref, gesture: completed.swipe.gesture, dwell: completed.swipe.dwell } },
    stageReceipt: staged.receipt,
    responseReceipt: completed.receipt,
    stateVersion: completed.receipt.afterVersion,
    guidance: "The participant responded on the webpage. Use inspect_room before adapting the next probe.",
  };
}

function recoveryResult(outcome: "timeout" | "aborted", staged: SuccessfulStage, probe: Card, stateVersion: number, what: string) {
  return {
    ok: false,
    outcome,
    error: { code: outcome === "timeout" ? "PARTICIPANT_TIMEOUT" : "INVOCATION_ABORTED", what, retry: "SAME_OPERATION_ID", insteadDo: "Call inspect_room. If the probe is still open, let the participant respond; then retry this operationId to recover the original result." },
    data: { probeRef: probe.ref, status: "awaiting_participant" },
    stageReceipt: staged.receipt,
    stateVersion,
    recovery: { tool: "inspect_room", stagedProbePreserved: true, retryOperationId: staged.receipt.operationId },
  };
}

function notifyWorkspaceChanged(stateVersion: number, onWorkspaceChanged?: (stateVersion: number) => void, onWorkspaceSyncError?: (error: unknown, stateVersion: number) => void): void {
  try { onWorkspaceChanged?.(stateVersion); } catch (error) {
    try { onWorkspaceSyncError?.(error, stateVersion); } catch { /* The response receipt remains authoritative. */ }
  }
}
