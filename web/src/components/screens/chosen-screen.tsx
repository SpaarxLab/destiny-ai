"use client";

import type { Hypothesis, RouteProposalSet } from "../../domain/workspace";
import { COPY, PROVENANCE_LABELS, ROUTE_LABELS } from "../../content/journey";
import { ActionButton } from "../primitives/action-button";
import { StepShell } from "../primitives/step-shell";

export function ChosenScreen({
  routeSet,
  hypothesis,
  receiptLine,
  busy,
  statusMessage,
  onReopen,
  onExport,
  onStartOver,
}: {
  routeSet: RouteProposalSet;
  hypothesis: Hypothesis;
  receiptLine: string;
  busy: boolean;
  statusMessage: string;
  onReopen: () => void;
  onExport: () => void;
  onStartOver: () => void;
}) {
  const route = routeSet.routes.find((candidate) => candidate.ref === routeSet.selectedRouteRef);
  if (!route) return null;
  const others = routeSet.routes.filter((candidate) => candidate.ref !== route.ref);

  return (
    <StepShell
      eyebrow="One direction moves forward"
      title={`You chose “${route.title}”`}
      description="A direction to learn from, not a verdict on your career."
      wide
    >
      <div className="chosen">
        <article className="chosen__card">
          <p className="route-kind">{ROUTE_LABELS[route.kind].name} · {PROVENANCE_LABELS[routeSet.createdBy]}</p>
          <h2>{route.test.action}</h2>
          <dl className="route-facts">
            <div><dt>It should teach you</dt><dd>{route.learningQuestion}</dd></div>
            <div><dt>Boundary</dt><dd>{route.constraint}</dd></div>
            <div><dt>In your words</dt><dd>“{route.sourceQuotes[0]?.quote}”</dd></div>
            <div><dt>Stronger if</dt><dd>{route.strengthensWhen}</dd></div>
            <div><dt>Weaker if</dt><dd>{route.weakensWhen}</dd></div>
          </dl>
          <p className="receipt-line" data-testid="receipt-line">{receiptLine}</p>
        </article>

        <aside className="chosen__history" aria-label="Routes you did not choose">
          <p className="eyebrow">Kept in your history</p>
          <ul>
            {others.map((other) => (
              <li key={other.ref}>
                <strong>{ROUTE_LABELS[other.kind].name}</strong> {other.title}
                {other.status === "rejected" ? <span className="tag tag--quiet">Set aside</span> : null}
              </li>
            ))}
          </ul>
          <p className="chosen__note">Running this test and recording what you noticed comes next. Your confidence is {Math.round(hypothesis.confidence * 100)} out of 100 until real evidence moves it.</p>
        </aside>
      </div>

      <div className="status-region" role="status" aria-live="polite" aria-atomic="true">{statusMessage}</div>
      <div className="step-actions step-actions--three">
        <ActionButton disabled={busy} onClick={onReopen}>Reopen exploring</ActionButton>
        <ActionButton disabled={busy} onClick={onExport}>Export my room</ActionButton>
        <ActionButton disabled={busy} onClick={onStartOver} tone="quiet">{COPY.startOver}</ActionButton>
      </div>
    </StepShell>
  );
}
