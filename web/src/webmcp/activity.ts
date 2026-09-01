/**
 * One plain-language record of one agent tool invocation on this page. It is an ephemeral
 * session projection for the visible activity rail; it never becomes workspace authority.
 * Summaries are written for the participant and never contain tool names.
 */
export interface AgentActivityEvent {
  id: string;
  at: string;
  tool: "read_workspace" | "get_method_guide" | "propose_route_set" | "draft_words";
  outcome: "ok" | "denied" | "stale_registration";
  effect: "READ" | "PROPOSED" | "REPLAY" | "AWAITING_HUMAN" | "NONE";
  summary: string;
  code?: string;
  stateVersion: number;
  changedRefs?: string[];
}

export type AgentActivityListener = (event: AgentActivityEvent) => void;

let counter = 0;

export function activityEvent(
  fields: Omit<AgentActivityEvent, "id" | "at">,
): AgentActivityEvent {
  counter += 1;
  return {
    id: `activity-${Date.now().toString(36)}-${counter}`,
    at: new Date().toISOString(),
    ...fields,
  };
}

export function emitActivity(
  listener: AgentActivityListener | undefined,
  fields: Omit<AgentActivityEvent, "id" | "at">,
): void {
  if (!listener) return;
  try {
    listener(activityEvent(fields));
  } catch {
    // A visible activity notification must never replace or hide a tool result.
  }
}

export const STALE_REGISTRATION_SUMMARY =
  "ChatGPT used an outdated view of this page and was asked to look again.";

/**
 * Translate a typed command denial into one sentence the participant can read.
 */
export function denialSummary(error: { code: string; what: string }): string {
  const what = error.what.toLowerCase();
  switch (error.code) {
    case "POLICY_DENIED":
      if (what.includes("quote")) return "ChatGPT's proposal was declined: a quote did not match your words.";
      if (what.includes("limit") || what.includes("cap")) return "ChatGPT's proposal was declined: a test went over your limits.";
      if (what.includes("carried") || what.includes("carry") || what.includes("kept")) {
        return "ChatGPT's proposal was declined: it tried to change a route you kept.";
      }
      if (what.includes("ref")) return "ChatGPT's proposal was declined: it reused a name that already exists.";
      if (what.includes("distinct") || what.includes("exactly one")) {
        return "ChatGPT's proposal was declined: the three routes were not different enough.";
      }
      return "ChatGPT's proposal was declined because it broke a room rule. Nothing changed.";
    case "WRONG_LIFECYCLE":
      if (what.includes("follow-up")) return "ChatGPT tried to ask again while its question is still waiting for you.";
      return "ChatGPT tried to propose again, but your routes are still waiting for you.";
    case "WRONG_PHASE":
      return "ChatGPT tried to propose after you chose a direction. Nothing changed.";
    case "WRONG_ACTOR":
      return "ChatGPT tried to make a decision that is yours alone. Nothing changed.";
    case "STALE_STATE":
      return "ChatGPT was working from an older view of the room and will read it again.";
    case "OPERATION_CONFLICT":
      return "ChatGPT reused an earlier request id for something new. Nothing changed.";
    case "UNKNOWN_REF":
      return "ChatGPT referred to something that is not in your room. Nothing changed.";
    case "MALFORMED_INPUT":
      return "ChatGPT sent a request the room could not understand. Nothing changed.";
    case "STORAGE_FAILURE":
      return "This browser could not save. Nothing changed; try again in a moment.";
    case "STALE_REGISTRATION":
      return STALE_REGISTRATION_SUMMARY;
    default:
      return "ChatGPT's request was declined. Nothing changed.";
  }
}
