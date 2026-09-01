"use client";

import type { FormEvent } from "react";
import { COPY, questionById } from "../../content/journey";
import { ActionButton } from "../primitives/action-button";
import { ProgressTrack } from "../primitives/progress-track";
import { StepShell } from "../primitives/step-shell";

export function ConfirmWordsScreen({
  answers,
  agentDrafted,
  statusMessage,
  onChange,
  onBack,
  onSubmit,
}: {
  answers: Array<[string, string]>;
  agentDrafted: Record<string, boolean>;
  statusMessage: string;
  onChange: (id: string, value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <StepShell
      eyebrow="Check your wording"
      title="Do these still sound like you?"
      description="Routes may quote these exact words. Edit anything that feels too neat."
      progress={<ProgressTrack current={answers.length} total={answers.length} label="Answers written" />}
    >
      <form className="answer-form confirm-form" onSubmit={submit}>
        {answers.map(([id, text]) => (
          <div key={id} className="confirm-field">
            <label htmlFor={`confirm-${id}`}>{questionById(id)?.prompt ?? "Your words"}</label>
            {agentDrafted[id] ? <p className="draft-note">{COPY.agentName} drafted these words. Edit or confirm them.</p> : null}
            <textarea
              id={`confirm-${id}`}
              maxLength={500}
              required
              value={text}
              onChange={(event) => onChange(id, event.target.value)}
            />
          </div>
        ))}
        <div className="status-region" role="status" aria-live="polite" aria-atomic="true">{statusMessage}</div>
        <div className="step-actions">
          <ActionButton onClick={onBack}>{COPY.back}</ActionButton>
          <ActionButton tone="primary" type="submit">Use these words</ActionButton>
        </div>
      </form>
    </StepShell>
  );
}
