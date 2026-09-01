import { COPY } from "../../content/journey";
import { ActionButton } from "../primitives/action-button";
import { StepShell } from "../primitives/step-shell";

export function WelcomeScreen({
  canResume,
  onStart,
  onResume,
  onStartOver,
}: {
  canResume: boolean;
  onStart: () => void;
  onResume: () => void;
  onStartOver: () => void;
}) {
  return (
    <StepShell eyebrow="A small direction lab" title={COPY.promise} description={COPY.intro}>
      <ol className="preview" aria-label="What happens">
        <li><span>1</span><p><strong>Say what is stuck</strong> in your own words.</p></li>
        <li><span>2</span><p><strong>See three routes</strong> that quote you exactly.</p></li>
        <li><span>3</span><p><strong>Choose one small test.</strong> Nothing is chosen for you.</p></li>
      </ol>
      <p className="privacy-note">{COPY.privacy}</p>
      <div className="stack">
        {canResume ? (
          <>
            <ActionButton onClick={onResume} tone="primary" fullWidth>{COPY.resume}</ActionButton>
            <ActionButton onClick={onStartOver} tone="quiet" fullWidth>{COPY.startOver}</ActionButton>
          </>
        ) : (
          <ActionButton onClick={onStart} tone="primary" fullWidth>{COPY.start}</ActionButton>
        )}
      </div>
    </StepShell>
  );
}
