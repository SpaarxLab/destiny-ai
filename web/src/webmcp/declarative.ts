"use client";

import { useCallback, type FormEvent } from "react";
import { denialSummary, emitActivity, type AgentActivityListener } from "./activity";

export const DRAFT_WORDS_TOOL_NAME = "draft_words";
export const DRAFT_WORDS_DESCRIPTION =
  "Stage draft wording into the participant's own answer box on this screen. This never saves anything: the participant reads the draft, edits it, and only they can confirm it. Use it when the participant dictated an answer in chat and wants it placed in the room. Input: text (the draft, at most 500 characters).";
export const DRAFT_WORDS_PARAM_DESCRIPTION =
  "The draft answer in the participant's own words, at most 500 characters.";

/**
 * Result the declarative form hands back to the browser through `SubmitEvent.respondWith` when a
 * tool (not the participant) submitted it. It mirrors the product envelope: a prepared UI effect
 * that awaits the human.
 */
export const DRAFT_WORDS_STAGED_RESULT = {
  ok: true,
  effect: "AWAITING_HUMAN",
  guidance: "The words are staged in the participant's box; only the participant can confirm them.",
} as const;

export const DRAFT_WORDS_REJECTED_RESULT = {
  ok: false,
  error: {
    code: "MALFORMED_INPUT",
    what: "draft_words requires non-empty text of at most 500 characters.",
    retry: "NEVER",
    insteadDo: "Send text between 1 and 500 characters.",
  },
  guidance: "Nothing was staged because the draft was empty or too long.",
} as const;

/**
 * Chrome exposes `respondWith` on every SubmitEvent prototype but only permits it when the
 * submission was agent-invoked (`agentInvoked === true`). Detection must use that flag.
 */
interface ToolSubmitEvent extends Event {
  agentInvoked?: boolean;
  respondWith?: (result: unknown) => void;
}

export interface DeclarativeDraftFormProps {
  toolname: string;
  tooldescription: string;
  toolautosubmit: string;
}

export interface UseDeclarativeDraftFormOptions {
  onDraft(text: string): void;
  onAgentActivity?: AgentActivityListener;
  maxLength?: number;
}

/**
 * Wires a participant `<form>` as a declarative WebMCP tool with PREPARE_UI semantics.
 *
 * Chrome synthesizes the tool from the form markup. When an agent executes it, Chrome fills the
 * fields and (because `toolautosubmit` is present) dispatches `submit` with `agentInvoked === true`
 * and a callable `respondWith`. We prevent the default submission, stage the text through
 * `onDraft`, and answer the agent with an AWAITING_HUMAN result. A human submission has
 * `agentInvoked` false, so the caller handles it as usual (`handleToolSubmit` returns false).
 */
export function useDeclarativeDraftForm({
  onDraft,
  onAgentActivity,
  maxLength = 500,
}: UseDeclarativeDraftFormOptions) {
  const handleToolSubmit = useCallback((event: FormEvent<HTMLFormElement>): boolean => {
    const native = event.nativeEvent as ToolSubmitEvent;
    if (native.agentInvoked !== true || typeof native.respondWith !== "function") return false;
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const raw = data.get("text");
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text.length === 0 || text.length > maxLength) {
      emitActivity(onAgentActivity, {
        tool: "draft_words",
        outcome: "denied",
        effect: "NONE",
        summary: denialSummary(DRAFT_WORDS_REJECTED_RESULT.error),
        code: DRAFT_WORDS_REJECTED_RESULT.error.code,
        stateVersion: 0,
      });
      native.respondWith(DRAFT_WORDS_REJECTED_RESULT);
      return true;
    }
    onDraft(text);
    emitActivity(onAgentActivity, {
      tool: "draft_words",
      outcome: "ok",
      effect: "AWAITING_HUMAN",
      summary: "ChatGPT placed draft words in your box. Nothing is saved until you confirm.",
      stateVersion: 0,
    });
    native.respondWith(DRAFT_WORDS_STAGED_RESULT);
    return true;
  }, [maxLength, onAgentActivity, onDraft]);

  const formProps: DeclarativeDraftFormProps = {
    toolname: DRAFT_WORDS_TOOL_NAME,
    tooldescription: DRAFT_WORDS_DESCRIPTION,
    toolautosubmit: "",
  };

  return {
    formProps,
    textareaProps: { name: "text", toolparamdescription: DRAFT_WORDS_PARAM_DESCRIPTION },
    handleToolSubmit,
  };
}
