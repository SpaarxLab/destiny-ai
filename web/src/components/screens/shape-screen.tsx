import { COPY, STUCK_CHOICES, type StuckShape } from "../../content/journey";
import { ActionButton } from "../primitives/action-button";
import { ProgressTrack } from "../primitives/progress-track";
import { StepShell } from "../primitives/step-shell";

export function ShapeScreen({
  shape,
  onSelect,
  onBack,
  onContinue,
}: {
  shape: StuckShape | undefined;
  onSelect: (shape: StuckShape) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <StepShell
      eyebrow="Start where you are"
      title="What shape does stuck have today?"
      description="This only changes the first question. It does not label you."
      progress={<ProgressTrack current={0} total={3} label="Questions answered" />}
    >
      <fieldset className="choice-list">
        <legend className="sr-only">Choose the shape of stuck</legend>
        {STUCK_CHOICES.map((choice) => (
          <label key={choice.id} className="choice-card">
            <input name="stuck-shape" type="radio" checked={shape === choice.id} onChange={() => onSelect(choice.id)} />
            <span><strong>{choice.title}</strong><small>{choice.description}</small></span>
          </label>
        ))}
      </fieldset>
      <div className="step-actions">
        <ActionButton onClick={onBack}>{COPY.back}</ActionButton>
        <ActionButton disabled={!shape} onClick={onContinue} tone="primary">{COPY.continue}</ActionButton>
      </div>
    </StepShell>
  );
}
