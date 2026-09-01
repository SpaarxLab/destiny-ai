"use client";

import { useRef, useState, type FormEvent } from "react";
import type { RouteEdit } from "../../domain/commands";
import type { RoutePreview } from "../../domain/workspace";
import { MARK_PROMPTS, ROUTE_LABELS } from "../../content/journey";
import type { RouteMarks } from "../journey/journey-state";
import { ActionButton } from "../primitives/action-button";

interface RouteCardProps {
  route: RoutePreview;
  marks: RouteMarks;
  busy: boolean;
  onMarksChange: (marks: RouteMarks) => void;
  onEdit: (edit: RouteEdit) => Promise<boolean>;
  onReject: () => Promise<boolean>;
  onChoose: () => Promise<void>;
}

export function RouteCard({
  route,
  marks,
  busy,
  onMarksChange,
  onEdit,
  onReject,
  onChoose,
}: RouteCardProps) {
  const [mode, setMode] = useState<"view" | "edit" | "reject">("view");
  const [title, setTitle] = useState(route.title);
  const [premise, setPremise] = useState(route.premise);
  const [learningQuestion, setLearningQuestion] = useState(route.learningQuestion);
  const [testAction, setTestAction] = useState(route.test.action);
  const editTrigger = useRef<HTMLButtonElement>(null);
  const rejectTrigger = useRef<HTMLButtonElement>(null);
  const label = ROUTE_LABELS[route.kind];
  const rejected = route.status === "rejected";

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const edit: RouteEdit = {
      routeRef: route.ref,
      title: title.trim(),
      premise: premise.trim(),
      learningQuestion: learningQuestion.trim(),
      test: { ...route.test, action: testAction.trim() },
    };
    if (await onEdit(edit)) {
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

  async function confirmReject() {
    if (await onReject()) {
      setMode("view");
    }
  }

  function cancelReject() {
    setMode("view");
    requestAnimationFrame(() => rejectTrigger.current?.focus());
  }

  return (
    <article className={`route-card route-card--${route.kind}${rejected ? " route-card--rejected" : ""}`}>
      <header className="route-card__header">
        <div>
          <p className="route-kind">{label.name}</p>
          <p className="route-kind__description">{label.description}</p>
        </div>
        {route.status === "edited" ? <span className="state-tag">Edited by you</span> : null}
        {rejected ? <span className="state-tag state-tag--quiet">Set aside</span> : null}
      </header>

      {rejected ? (
        <div className="route-card__rejected">
          <h2>{route.title}</h2>
          <p>This route stays in your history, but it is no longer in the comparison.</p>
        </div>
      ) : mode === "edit" ? (
        <form className="route-edit" onSubmit={saveEdit}>
          <h2>Edit this route</h2>
          <label htmlFor={`${route.ref}-title`}>Route title</label>
          <input
            id={`${route.ref}-title`}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
          <label htmlFor={`${route.ref}-premise`}>Why this may be worth testing</label>
          <textarea
            id={`${route.ref}-premise`}
            maxLength={600}
            onChange={(event) => setPremise(event.target.value)}
            required
            value={premise}
          />
          <label htmlFor={`${route.ref}-question`}>What this route should help you learn</label>
          <textarea
            id={`${route.ref}-question`}
            maxLength={300}
            onChange={(event) => setLearningQuestion(event.target.value)}
            required
            value={learningQuestion}
          />
          <label htmlFor={`${route.ref}-test`}>Small test idea</label>
          <textarea
            id={`${route.ref}-test`}
            maxLength={500}
            onChange={(event) => setTestAction(event.target.value)}
            required
            value={testAction}
          />
          <div className="button-row">
            <ActionButton disabled={busy} tone="primary" type="submit">Save route changes</ActionButton>
            <ActionButton disabled={busy} onClick={cancelEdit}>Cancel</ActionButton>
          </div>
        </form>
      ) : mode === "reject" ? (
        <div className="route-confirm" role="group" aria-labelledby={`${route.ref}-reject-title`}>
          <h2 id={`${route.ref}-reject-title`}>Set aside “{route.title}”?</h2>
          <p>It will leave the comparison. Your other routes will stay as they are.</p>
          <div className="button-row">
            <ActionButton disabled={busy} onClick={confirmReject} tone="danger">
              Set aside this route
            </ActionButton>
            <ActionButton disabled={busy} onClick={cancelReject}>Cancel</ActionButton>
          </div>
        </div>
      ) : (
        <>
          <div className="route-card__body">
            <h2>{route.title}</h2>
            <p className="route-premise">{route.premise}</p>

            <blockquote>
              <span>Your words</span>
              “{route.sourceQuotes[0]?.quote}”
            </blockquote>

            <dl className="route-facts">
              <div>
                <dt>Question to answer</dt>
                <dd>{route.learningQuestion}</dd>
              </div>
              <div>
                <dt>Small test</dt>
                <dd>{route.test.action}</dd>
              </div>
              <div>
                <dt>Boundary</dt>
                <dd>{route.constraint}</dd>
              </div>
            </dl>

            <fieldset className="route-marks">
              <legend>Make sense of this route</legend>
              {(Object.keys(MARK_PROMPTS) as Array<keyof RouteMarks>).map((key) => (
                <label key={key} htmlFor={`${route.ref}-${key}`}>
                  {MARK_PROMPTS[key]}
                  <textarea
                    id={`${route.ref}-${key}`}
                    maxLength={240}
                    onChange={(event) => onMarksChange({ ...marks, [key]: event.target.value })}
                    placeholder={key === "draws" ? "The part I want more of is…" : key === "worries" ? "I would need to watch for…" : "This could show me whether…"}
                    value={marks[key]}
                  />
                </label>
              ))}
            </fieldset>
          </div>

          <footer className="route-card__actions">
            <ActionButton disabled={busy} onClick={onChoose} tone="primary" fullWidth>
              Choose this to test
            </ActionButton>
            <div className="button-row button-row--split">
              <ActionButton
                disabled={busy}
                onClick={() => setMode("edit")}
                ref={editTrigger}
              >
                Edit this route
              </ActionButton>
              <ActionButton
                disabled={busy}
                onClick={() => setMode("reject")}
                ref={rejectTrigger}
                tone="quiet"
              >
                Set this aside
              </ActionButton>
            </div>
          </footer>
        </>
      )}
    </article>
  );
}
