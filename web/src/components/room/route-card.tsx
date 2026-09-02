"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import type { RouteEdit } from "../../domain/commands";
import type { QuoteSource, RoutePreview } from "../../domain/workspace";
import { ACTOR_NAMES, NOTE_PROMPTS, ROUTE_LABELS } from "../../content/journey";
import type { RouteNotes } from "../journey/journey-state";
import { ActionButton } from "../primitives/action-button";

export type RouteProvenance = "chatgpt_webmcp" | "participant" | "embedded_inference";

interface RouteCardProps {
  route: RoutePreview;
  provenance: RouteProvenance;
  /** True when this route is a fresh replacement inside a set that carried other routes over. */
  replacement: boolean;
  notes: RouteNotes;
  busy: boolean;
  onNotesChange: (notes: RouteNotes) => void;
  onEdit: (edit: RouteEdit) => Promise<boolean>;
  onSetAside: () => Promise<boolean>;
  onChoose: () => Promise<void>;
  onHighlight: (quotes: QuoteSource[] | null) => void;
}

export function RouteCard({
  route,
  provenance,
  replacement,
  notes,
  busy,
  onNotesChange,
  onEdit,
  onSetAside,
  onChoose,
  onHighlight,
}: RouteCardProps) {
  const [mode, setMode] = useState<"view" | "edit" | "set-aside">("view");
  const [showNotes, setShowNotes] = useState(false);
  const [title, setTitle] = useState(route.title);
  const [premise, setPremise] = useState(route.premise);
  const [learningQuestion, setLearningQuestion] = useState(route.learningQuestion);
  const [testAction, setTestAction] = useState(route.test.action);
  const editTrigger = useRef<HTMLButtonElement>(null);
  const setAsideTrigger = useRef<HTMLButtonElement>(null);
  const firstEditField = useRef<HTMLInputElement>(null);
  const confirmSetAside = useRef<HTMLButtonElement>(null);
  const baseId = useId();
  const label = ROUTE_LABELS[route.kind];
  const rejected = route.status === "rejected";
  const agentName = provenance === "participant" ? null : ACTOR_NAMES[provenance];

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onEdit({
      routeRef: route.ref,
      title: title.trim(),
      premise: premise.trim(),
      learningQuestion: learningQuestion.trim(),
      test: { ...route.test, action: testAction.trim() },
    });
    if (saved) {
      setMode("view");
      requestAnimationFrame(() => editTrigger.current?.focus());
    }
  }

  function cancelEdit() {
    setTitle(route.title);
    setPremise(route.premise);
    setLearningQuestion(route.learningQuestion);
    setTestAction(route.test.action);
    setMode("view");
    requestAnimationFrame(() => editTrigger.current?.focus());
  }

  if (rejected) {
    return (
      <article className={`route-card route-card--${route.kind} route-card--aside`} data-route-ref={route.ref}>
        <header className="route-card__head">
          <p className="route-kind">{label.name}</p>
          <span className="tag tag--quiet">Set aside</span>
        </header>
        <h2 className="route-card__title">{route.title}</h2>
        <p className="route-card__muted">Kept in your history. It is out of the running.</p>
      </article>
    );
  }

  return (
    <article
      className={`route-card route-card--${route.kind}`}
      data-route-ref={route.ref}
      onMouseEnter={() => onHighlight(route.sourceQuotes)}
      onMouseLeave={() => onHighlight(null)}
      onFocus={() => onHighlight(route.sourceQuotes)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onHighlight(null);
      }}
    >
      <header className="route-card__head">
        <div>
          <p className="route-kind">{label.name}</p>
          <p className="route-kind__description">{label.description}</p>
        </div>
        <div className="route-card__tags">
          {route.status === "edited" ? <span className="tag">Edited by you</span> : null}
          {route.carriedFromRouteRef ? <span className="tag tag--quiet">Kept from your last set</span> : null}
          {replacement && agentName ? <span className="tag tag--accent">Replaced by {agentName}</span> : null}
        </div>
      </header>

      {mode === "edit" ? (
        <form className="route-edit" onSubmit={saveEdit}>
          <label htmlFor={`${baseId}-title`}>Title</label>
          <input id={`${baseId}-title`} maxLength={120} required ref={firstEditField} value={title} onChange={(event) => setTitle(event.target.value)} />
          <label htmlFor={`${baseId}-premise`}>Why it may be worth testing</label>
          <textarea id={`${baseId}-premise`} maxLength={600} required value={premise} onChange={(event) => setPremise(event.target.value)} />
          <label htmlFor={`${baseId}-question`}>What it should teach you</label>
          <textarea id={`${baseId}-question`} maxLength={300} required value={learningQuestion} onChange={(event) => setLearningQuestion(event.target.value)} />
          <label htmlFor={`${baseId}-test`}>Small test</label>
          <textarea id={`${baseId}-test`} maxLength={500} required value={testAction} onChange={(event) => setTestAction(event.target.value)} />
          <div className="button-row">
            <ActionButton disabled={busy} tone="primary" type="submit">Save changes</ActionButton>
            <ActionButton disabled={busy} onClick={cancelEdit}>Cancel</ActionButton>
          </div>
        </form>
      ) : mode === "set-aside" ? (
        <div className="route-confirm" role="group" aria-labelledby={`${baseId}-aside-title`}>
          <h2 id={`${baseId}-aside-title`}>Set aside “{route.title}”?</h2>
          <p>It leaves the running and stays in your history.</p>
          <div className="button-row">
            <ActionButton
              disabled={busy}
              onClick={async () => { if (await onSetAside()) setMode("view"); }}
              ref={confirmSetAside}
              tone="danger"
            >
              Set aside
            </ActionButton>
            <ActionButton disabled={busy} onClick={() => { setMode("view"); requestAnimationFrame(() => setAsideTrigger.current?.focus()); }}>Cancel</ActionButton>
          </div>
        </div>
      ) : (
        <>
          <div className="route-card__body">
            <h2 className="route-card__title">{route.title}</h2>
            <p className="route-card__premise">{route.premise}</p>
            <dl className="route-facts">
              <div>
                <dt>Question this tests</dt>
                <dd>{route.learningQuestion}</dd>
              </div>
              {route.majorTradeoff ? <div><dt>The tradeoff</dt><dd>{route.majorTradeoff}</dd></div> : null}
              <div>
                <dt>Try this week</dt>
                <dd>
                  {route.test.action}
                  <span className="route-facts__limits">
                    Up to {route.test.maximumDays} {route.test.maximumDays === 1 ? "day" : "days"} · {route.test.maximumHours} hours · {route.test.maximumMoney === 0 ? "no spend" : `${route.test.maximumMoney} ${route.test.currency}`}
                  </span>
                </dd>
              </div>
            </dl>
            <details className="route-notes">
              <summary>See the week and signals</summary>
              {route.sourceQuotes[0] ? <blockquote className="route-card__quote">
                <span>Based on your response</span>
                “{route.sourceQuotes[0]?.quote}”
              </blockquote> : null}
              <dl className="route-facts">
                {route.sampleWeek ? <div><dt>What the week could look like</dt><dd><ul>{route.sampleWeek.map((item) => <li key={item}>{item}</li>)}</ul></dd></div> : null}
                {route.responsibilities ? <div><dt>What you would own</dt><dd>{route.responsibilities.join(" · ")}{route.decisions ? ` Decisions: ${route.decisions.join(" · ")}` : ""}</dd></div> : null}
                {route.collaborationShape || route.deepWorkShape ? <div><dt>How the work feels</dt><dd>{route.collaborationShape}{route.collaborationShape && route.deepWorkShape ? " · " : ""}{route.deepWorkShape}</dd></div> : null}
                <div><dt>Safety boundary</dt><dd>{route.constraint}{route.participantLimits ? ` · ${route.participantLimits}` : ""}</dd></div>
                {route.learningSignals ? <div><dt>What to notice</dt><dd>If it works: {route.learningSignals.success}<br />If it does not: {route.learningSignals.failure}<br />Either way: {route.learningSignals.learning}</dd></div> : null}
              </dl>
            </details>
            <details className="route-notes" open={showNotes} onToggle={(event) => setShowNotes(event.currentTarget.open)}>
              <summary>Write a private note</summary>
              <p className="route-notes__hint">Kept on this device only. Agents cannot read these.</p>
              {(Object.keys(NOTE_PROMPTS) as Array<keyof RouteNotes>).map((key) => (
                <label key={key} htmlFor={`${baseId}-${key}`}>
                  {NOTE_PROMPTS[key]}
                  <textarea
                    id={`${baseId}-${key}`}
                    maxLength={240}
                    value={notes[key]}
                    onChange={(event) => onNotesChange({ ...notes, [key]: event.target.value })}
                  />
                </label>
              ))}
            </details>
          </div>
          <footer className="route-card__actions">
            <div className="button-row button-row--split">
              <ActionButton disabled={busy} onClick={() => { setMode("edit"); requestAnimationFrame(() => firstEditField.current?.focus()); }} ref={editTrigger}>
                Change
              </ActionButton>
              <ActionButton disabled={busy} onClick={() => { setMode("set-aside"); requestAnimationFrame(() => confirmSetAside.current?.focus()); }} ref={setAsideTrigger} tone="quiet">
                Set aside
              </ActionButton>
            </div>
            <ActionButton disabled={busy} onClick={onChoose} tone="primary" fullWidth>
              Choose this test
            </ActionButton>
          </footer>
        </>
      )}
    </article>
  );
}
