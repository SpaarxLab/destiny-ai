"use client";

import { useState, type FormEvent } from "react";
import type { FollowUpQuestion } from "../../domain/workspace";
import { ACTOR_NAMES } from "../../content/journey";
import { useDeclarativeDraftForm } from "../../webmcp/declarative";
import { ActionButton } from "../primitives/action-button";
import type { WordSlip } from "./words-panel";

export function FollowUpCard({
  followUp,
  words,
  busy,
  onAnswer,
  onSkip,
}: {
  followUp: FollowUpQuestion;
  words: WordSlip[];
  busy: boolean;
  onAnswer: (text: string) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [drafted, setDrafted] = useState(false);
  const draftForm = useDeclarativeDraftForm({
    onDraft: (draft) => {
      setText(draft);
      setDrafted(true);
    },
  });
  const reasons = words.filter((word) => followUp.reasonRefs.includes(word.ref));
  const agentName = ACTOR_NAMES[followUp.askedBy];

  function submit(event: FormEvent<HTMLFormElement>) {
    if (draftForm.handleToolSubmit(event)) return;
    event.preventDefault();
    if (!text.trim()) return;
    void onAnswer(text.trim());
  }

  return (
    <section className="follow-up" aria-labelledby="follow-up-title">
      <p className="eyebrow">{agentName} asked one question before proposing</p>
      <h2 id="follow-up-title">{followUp.question}</h2>
      {reasons.length ? (
        <div className="follow-up__reasons">
          <p>It was reading these words of yours:</p>
          <ul>
            {reasons.map((reason) => <li key={reason.ref}><blockquote>“{reason.text}”</blockquote></li>)}
          </ul>
        </div>
      ) : null}
      <form {...draftForm.formProps} className="answer-form" onSubmit={submit}>
        <label htmlFor="follow-up-answer">Your answer, in your words</label>
        {drafted ? <p className="draft-note">{agentName} drafted these words. Edit or confirm them.</p> : null}
        <textarea
          {...draftForm.textareaProps}
          id="follow-up-answer"
          maxLength={500}
          required
          value={text}
          onChange={(event) => { setText(event.target.value); setDrafted(false); }}
        />
        <div className="button-row">
          <ActionButton disabled={busy || !text.trim()} tone="primary" type="submit">Answer</ActionButton>
          <ActionButton disabled={busy} onClick={() => void onSkip()} tone="quiet">Skip this question</ActionButton>
        </div>
      </form>
    </section>
  );
}
