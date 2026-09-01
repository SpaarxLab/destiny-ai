"use client";

import type { FormEvent } from "react";
import { COPY, type JourneyQuestion } from "../../content/journey";
import { useDeclarativeDraftForm } from "../../webmcp/declarative";
import { ActionButton } from "../primitives/action-button";
import { ProgressTrack } from "../primitives/progress-track";
import { StepShell } from "../primitives/step-shell";

export function QuestionScreen({
  question,
  index,
  total,
  value,
  agentDrafted,
  statusMessage,
  onChange,
  onAgentDraft,
  onBack,
  onSkip,
  onSubmit,
}: {
  question: JourneyQuestion;
  index: number;
  total: number;
  value: string;
  agentDrafted: boolean;
  statusMessage: string;
  onChange: (value: string) => void;
  onAgentDraft: (value: string) => void;
  onBack: () => void;
  onSkip: () => void;
  onSubmit: () => void;
}) {
  const draftForm = useDeclarativeDraftForm({ onDraft: onAgentDraft });

  function submit(event: FormEvent<HTMLFormElement>) {
    if (draftForm.handleToolSubmit(event)) return;
    event.preventDefault();
    onSubmit();
  }

  return (
    <StepShell
      eyebrow={question.eyebrow}
      title={question.prompt}
      description={question.hint}
      progress={<ProgressTrack current={index} total={total} label="Questions answered" />}
    >
      <form {...draftForm.formProps} className="answer-form" onSubmit={submit}>
        <label htmlFor={`answer-${question.id}`}>Your words</label>
        {agentDrafted ? <p className="draft-note">{COPY.agentName} drafted these words. Edit or confirm them.</p> : null}
        <textarea
          {...draftForm.textareaProps}
          id={`answer-${question.id}`}
          autoFocus
          maxLength={500}
          placeholder={question.placeholder}
          required={!question.skippable}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="field-meta">
          <span>{question.skippable ? "Optional" : "One sentence is enough"}</span>
          <span className="number">{value.length}/500</span>
        </div>
        <div className="status-region" role="status" aria-live="polite" aria-atomic="true">{statusMessage}</div>
        <div className="step-actions">
          <ActionButton onClick={onBack}>{COPY.back}</ActionButton>
          <div className="step-actions__forward">
            {question.skippable ? <ActionButton onClick={onSkip} tone="quiet">{COPY.skip}</ActionButton> : null}
            <ActionButton tone="primary" type="submit">{COPY.continue}</ActionButton>
          </div>
        </div>
      </form>
    </StepShell>
  );
}
