import { forwardRef, type ReactNode } from "react";

interface StepShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  progress?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}

export const StepShell = forwardRef<HTMLHeadingElement, StepShellProps>(function StepShell(
  { eyebrow, title, description, progress, children, wide = false },
  ref,
) {
  return (
    <section className={`step-shell${wide ? " step-shell--wide" : ""}`} aria-labelledby="journey-step-title">
      {progress}
      <div className="step-shell__heading">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 id="journey-step-title" ref={ref} tabIndex={-1}>{title}</h1>
        {description ? <p className="step-shell__description">{description}</p> : null}
      </div>
      {children}
    </section>
  );
});
