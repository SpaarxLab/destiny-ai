"use client";

import { COPY, ROUTE_LABELS } from "../../content/journey";
import type { JourneyDraft, ManualRouteDraft } from "../journey/journey-state";
import { ActionButton } from "../primitives/action-button";
import { StepShell } from "../primitives/step-shell";
import type { WordSlip } from "../room/words-panel";

const KINDS = ["closest", "bridge", "probe"] as const;

export function WorkshopScreen({
  drafts,
  words,
  busy,
  statusMessage,
  onChange,
  onBack,
  onSave,
}: {
  drafts: JourneyDraft["routeDrafts"];
  words: WordSlip[];
  busy: boolean;
  statusMessage: string;
  onChange: (index: number, changes: Partial<ManualRouteDraft>) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <StepShell
      eyebrow="Draft by hand"
      title="Make these three drafts sound like you."
      description="Starter wording, not advice. Each quotes one of your answers."
      wide
    >
      <div className="workshop">
        {drafts.map((draft, index) => {
          const kind = KINDS[index];
          const quoted = words[index % Math.max(1, words.length)];
          return (
            <fieldset className="workshop-card" key={kind}>
              <legend>{ROUTE_LABELS[kind].name}</legend>
              {quoted ? <blockquote className="workshop-card__quote">“{quoted.text}”</blockquote> : null}
              <label>Title<input maxLength={120} required value={draft.title} onChange={(event) => onChange(index, { title: event.target.value })} /></label>
              <label>Why it may be worth testing<textarea maxLength={600} required value={draft.premise} onChange={(event) => onChange(index, { premise: event.target.value })} /></label>
              <label>What it should teach you<textarea maxLength={300} required value={draft.learningQuestion} onChange={(event) => onChange(index, { learningQuestion: event.target.value })} /></label>
              <label>Small test<textarea maxLength={500} required value={draft.testAction} onChange={(event) => onChange(index, { testAction: event.target.value })} /></label>
            </fieldset>
          );
        })}
      </div>
      <div className="status-region" role="status" aria-live="polite" aria-atomic="true">{statusMessage}</div>
      <div className="step-actions">
        <ActionButton disabled={busy} onClick={onBack}>{COPY.back}</ActionButton>
        <ActionButton disabled={busy} onClick={onSave} tone="primary">{busy ? "Saving…" : "Put these in my room"}</ActionButton>
      </div>
    </StepShell>
  );
}
