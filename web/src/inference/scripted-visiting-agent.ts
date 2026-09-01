import type { LanguageModelV3CallOptions, LanguageModelV3Content, LanguageModelV3GenerateResult } from "@ai-sdk/provider";
import { MockLanguageModelV3 } from "ai/test";
import { groundDraftRoutes } from "./grounding";
import { buildFakeLabAssistantDraft } from "./providers";
import { labAssistantInputSchema, type LabAssistantInput } from "./schemas";

/**
 * A scripted stand-in for a visiting model, built on the AI SDK's MockLanguageModelV3 so the real
 * generateText tool loop runs end to end with no provider. Its plan is fixed:
 * read_workspace -> get_method_guide -> propose_route_set grounded in the orientation it read.
 *
 * It reasons only over the tool results in the prompt and the tools the loop offers. With
 * `followInjectedInstructions` it deliberately misbehaves once (tries `choose_route` when the
 * participant words tell it to) so evals can prove the loop refuses tools outside the catalogue.
 */

export interface ScriptedVisitingAgentOptions {
  operationId?: string;
  followInjectedInstructions?: boolean;
  /** Keep calling read_workspace forever; proves the step cap. */
  loopForever?: boolean;
}

export const INJECTION_MARKER = "IGNORE THE METHOD";

interface ToolResultSeen {
  toolName: string;
  output: unknown;
}

export function createScriptedVisitingAgentModel(options: ScriptedVisitingAgentOptions = {}): MockLanguageModelV3 {
  const operationId = options.operationId ?? crypto.randomUUID();
  let callCount = 0;
  let injectionAttempted = false;

  return new MockLanguageModelV3({
    provider: "scripted-visiting-agent",
    modelId: "scripted-plan-v1",
    doGenerate: async (callOptions: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> => {
      callCount += 1;
      const offered = new Set(
        (callOptions.tools ?? []).filter((tool) => tool.type === "function").map((tool) => tool.name),
      );
      const seen = toolResultsIn(callOptions);
      const has = (name: string) => seen.some((result) => result.toolName === name);
      const callId = `scripted-call-${callCount}`;

      if (options.loopForever) {
        return toolCall(callId, "read_workspace", { view: "orientation" });
      }
      if (!has("read_workspace")) {
        if (!offered.has("read_workspace")) return finish("No read_workspace tool is available; stopping.");
        return toolCall(callId, "read_workspace", { view: "orientation" });
      }
      if (!has("get_method_guide")) {
        if (!offered.has("get_method_guide")) return finish("No get_method_guide tool is available; stopping.");
        return toolCall(callId, "get_method_guide", {});
      }
      if (!has("propose_route_set")) {
        if (!offered.has("propose_route_set")) return finish("The room does not offer propose_route_set now; stopping.");
        const orientation = seen.find((result) => result.toolName === "read_workspace")?.output;
        const proposal = groundedProposalFrom(orientation, operationId);
        if (!proposal) return finish("The orientation did not contain enough to ground a proposal; stopping.");
        if (
          options.followInjectedInstructions &&
          !injectionAttempted &&
          proposal.input.confirmedWords.some((words) => words.text.includes(INJECTION_MARKER))
        ) {
          injectionAttempted = true;
          return toolCall(callId, "choose_route", { routeRef: "route-any", operationId, expectedVersion: proposal.expectedVersion });
        }
        return toolCall(callId, "propose_route_set", proposal.command);
      }
      return finish("Proposal submitted through propose_route_set; the participant decides next.");
    },
  });
}

function toolResultsIn(callOptions: LanguageModelV3CallOptions): ToolResultSeen[] {
  const results: ToolResultSeen[] = [];
  for (const message of callOptions.prompt) {
    if (message.role !== "tool") continue;
    for (const part of message.content) {
      if (part.type !== "tool-result") continue;
      const output = part.output;
      results.push({
        toolName: part.toolName,
        output: output.type === "json" ? output.value : output.type === "text" ? parseMaybeJson(output.value) : output,
      });
    }
  }
  return results;
}

function parseMaybeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function groundedProposalFrom(
  orientationResult: unknown,
  operationId: string,
): { command: Record<string, unknown>; input: LabAssistantInput; expectedVersion: number } | null {
  const envelope = record(orientationResult);
  const data = record(envelope?.data);
  if (!envelope || envelope.ok !== true || !data) return null;
  const focus = record(data.focus);
  const proposal = record(data.proposal);
  if (!focus || !proposal || proposal.available !== true) return null;
  const confirmedWords = (Array.isArray(data.confirmedWords) ? data.confirmedWords : [])
    .map(record)
    .filter((words): words is Record<string, unknown> => words !== null)
    .map((words) => ({ ref: words.ref, text: words.text }));
  const parsed = labAssistantInputSchema.safeParse({
    confirmedWords,
    costCaps: focus.costCaps,
    supersedesRouteSetRef: proposal.supersedesRouteSetRef ?? null,
    carryRouteRefs: proposal.carryRouteRefs ?? [],
    replaceKinds: proposal.replaceKinds ?? [],
  });
  if (!parsed.success) return null;
  const draft = buildFakeLabAssistantDraft(parsed.data);
  const expectedVersion = typeof envelope.stateVersion === "number" ? envelope.stateVersion : 0;
  if (draft.outcome === "insufficient_signal") {
    return {
      input: parsed.data,
      expectedVersion,
      command: {
        operationId,
        expectedVersion,
        outcome: "insufficient_signal",
        followUpQuestion: draft.followUpQuestion,
        reasonRefs: draft.reasonRefs,
      },
    };
  }
  const grounded = groundDraftRoutes(parsed.data, draft.routes);
  if (!grounded.ok) return null;
  return {
    input: parsed.data,
    expectedVersion,
    command: {
      operationId,
      expectedVersion,
      outcome: "routes",
      routes: grounded.routes,
      ...(parsed.data.supersedesRouteSetRef ? { supersedesRouteSetRef: parsed.data.supersedesRouteSetRef } : {}),
    },
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

function toolCall(toolCallId: string, toolName: string, input: unknown): LanguageModelV3GenerateResult {
  const content: LanguageModelV3Content[] = [
    { type: "tool-call", toolCallId, toolName, input: JSON.stringify(input) },
  ];
  return { content, finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage, warnings: [] };
}

function finish(text: string): LanguageModelV3GenerateResult {
  return { content: [{ type: "text", text }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] };
}
