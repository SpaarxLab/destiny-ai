"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createParticipantCommandAdapter, type ParticipantCommandAdapter } from "../../adapters/participant-command-adapter";
import { CommandKernel } from "../../commands/command-kernel";
import type { RouteEdit, RouteProposalInput } from "../../domain/commands";
import type { RouteProposalSet, Workspace } from "../../domain/workspace";
import { createEmptyWorkspace } from "../../domain/workspace";
import { LOCAL_WORKSPACE_KEY, LocalWorkspaceStore } from "../../storage/local-workspace-store";
import { WorkspaceReader } from "../../projections/workspace-reader";
import { WebMcpRegistrar } from "../../webmcp/registrar";
import {
  JOURNEY_COPY,
  STUCK_CHOICES,
  questionsFor,
  type StuckShape,
} from "../../content/journey";
import { ActionButton } from "../primitives/action-button";
import { ProgressTrack } from "../primitives/progress-track";
import { StepShell } from "../primitives/step-shell";
import { RouteRoom } from "../routes/route-room";
import {
  JOURNEY_DRAFT_KEY,
  answeredEntries,
  emptyJourneyDraft,
  parseJourneyDraft,
  type ConfirmedSource,
  type JourneyCaps,
  type JourneyDraft,
  type JourneyScreen,
  type RouteMarks,
} from "./journey-state";

interface JourneyRuntime {
  store: LocalWorkspaceStore;
  adapter: ParticipantCommandAdapter;
  reader: WorkspaceReader;
}

const ROUTE_KINDS = ["closest", "bridge", "probe"] as const;

export function DestinyJourney() {
  const runtime = useRef<JourneyRuntime | null>(null);
  const draftRef = useRef<JourneyDraft>(emptyJourneyDraft());
  const hasPresentedInitialScreen = useRef(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [reader, setReader] = useState<WorkspaceReader | null>(null);
  const [draft, setDraft] = useState<JourneyDraft>(emptyJourneyDraft);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const questions = useMemo(
    () => draft.shape ? questionsFor(draft.shape) : [],
    [draft.shape],
  );
  const answers = answeredEntries(draft);
  const latestRouteSet = workspace?.routeProposalSets.at(-1) ?? null;
  const chosenHypothesis = workspace?.hypotheses.at(-1) ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!("locks" in navigator)) {
      queueMicrotask(() => {
        if (!cancelled) {
          setStartupError("This browser cannot safely save changes across tabs. Open the journey in a current browser.");
          setReady(true);
        }
      });
      return () => { cancelled = true; };
    }

    const savedDraft = parseJourneyDraft(localStorage.getItem(JOURNEY_DRAFT_KEY));
    const store = new LocalWorkspaceStore(
      localStorage,
      createInitialWorkspace(savedDraft.caps),
      navigator.locks,
    );
    const adapter = createParticipantCommandAdapter(new CommandKernel(store));
    const workspaceReader = new WorkspaceReader(store);
    runtime.current = { store, adapter, reader: workspaceReader };

    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const currentWorkspace = store.load();
        const newestSet = currentWorkspace.routeProposalSets.at(-1);
        let nextDraft = savedDraft;

        if (currentWorkspace.hypotheses.length > 0) {
          nextDraft = { ...savedDraft, screen: "chosen" };
        } else if (newestSet?.status === "proposed") {
          nextDraft = { ...savedDraft, screen: "routes" };
        } else if (
          newestSet?.status === "resolved" &&
          !newestSet.selectedRouteRef &&
          newestSet.routes.every((route) => route.status === "rejected")
        ) {
          nextDraft = { ...savedDraft, screen: "all-rejected" };
        }

        draftRef.current = nextDraft;
        setDraft(nextDraft);
        setWorkspace(currentWorkspace);
        setReader(workspaceReader);
        setReady(true);
      } catch {
        setStartupError("Your saved journey could not be opened. Its original copy is still on this device.");
        setReady(true);
      }
    });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!hasPresentedInitialScreen.current) {
      hasPresentedInitialScreen.current = true;
      return;
    }
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("#journey-content h1")?.focus();
    });
  }, [ready, draft.screen, draft.questionIndex, draft.confirmIndex]);

  function commitDraft(update: (current: JourneyDraft) => JourneyDraft): JourneyDraft {
    const committed = update(draftRef.current);
    draftRef.current = committed;
    localStorage.setItem(JOURNEY_DRAFT_KEY, JSON.stringify(committed));
    setDraft(committed);
    return committed;
  }

  function moveTo(screen: JourneyScreen) {
    commitDraft((current) => ({ ...current, screen }));
    setStatusMessage("");
  }

  function saveAndExit() {
    commitDraft((current) => ({
      ...current,
      resumeScreen: current.screen === "saved" ? current.resumeScreen : current.screen,
      screen: "saved",
    }));
    setStatusMessage("Your place is saved on this device.");
  }

  function resumeJourney() {
    commitDraft((current) => ({
      ...current,
      screen: current.resumeScreen && current.resumeScreen !== "saved" ? current.resumeScreen : "shape",
      resumeScreen: undefined,
    }));
  }

  function chooseShape(shape: StuckShape) {
    commitDraft((current) => {
      const continuingSameBranch = current.startedShape === shape;
      return {
        ...current,
        shape,
        startedShape: shape,
        questionIndex: 0,
        confirmIndex: 0,
        answers: continuingSameBranch ? current.answers : {},
        confirmedSources: continuingSameBranch ? current.confirmedSources : [],
        reflectionOperationIds: continuingSameBranch ? current.reflectionOperationIds : {},
        screen: "questions",
      };
    });
  }

  function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = questions[draft.questionIndex];
    if (!question) return;
    const answer = draft.answers[question.id]?.trim() ?? "";
    if (!answer && !question.skippable) {
      setStatusMessage("Write a response before you continue.");
      return;
    }

    if (draft.questionIndex < questions.length - 1) {
      commitDraft((current) => ({ ...current, questionIndex: current.questionIndex + 1 }));
    } else {
      commitDraft((current) => ({ ...current, screen: "confirm", confirmIndex: 0 }));
    }
    setStatusMessage("");
  }

  function skipQuestion() {
    const question = questions[draft.questionIndex];
    if (!question?.skippable) return;
    commitDraft((current) => ({ ...current, answers: { ...current.answers, [question.id]: "" }, screen: "confirm", confirmIndex: 0 }));
    setStatusMessage("Skipped. Your earlier answers are enough to continue.");
  }

  function goBack() {
    if (draft.screen === "questions") {
      if (draft.questionIndex === 0) moveTo("shape");
      else commitDraft((current) => ({ ...current, questionIndex: current.questionIndex - 1 }));
      return;
    }
    if (draft.screen === "confirm") {
      if (draft.confirmIndex === 0) {
        commitDraft((current) => ({ ...current, screen: "questions", questionIndex: Math.max(0, questions.length - 1) }));
      } else {
        commitDraft((current) => ({ ...current, confirmIndex: current.confirmIndex - 1 }));
      }
      return;
    }
    if (draft.screen === "shape") moveTo("welcome");
  }

  function confirmCurrentWording(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entry = answers[draft.confirmIndex];
    if (!entry || !entry[1].trim()) {
      setStatusMessage("Keep at least one sentence in your own words.");
      return;
    }
    if (draft.confirmIndex < answers.length - 1) {
      commitDraft((current) => ({ ...current, confirmIndex: current.confirmIndex + 1 }));
    } else {
      moveTo("boundaries");
    }
  }

  function saveCaps(caps: JourneyCaps) {
    commitDraft((current) => ({ ...current, caps, screen: "workshop" }));
    setStatusMessage("");
  }

  async function buildRoutes() {
    if (!runtime.current || busy) return;
    if (!draft.caps || !draft.workshopReviewed) {
      setStatusMessage("Check your limits and review all three route drafts before continuing.");
      return;
    }
    const caps = draft.caps;
    setBusy(true);
    setStatusMessage("Saving your confirmed words…");
    try {
      let currentDraft = draft;
      if (!ensureRuntimeCaps(caps)) return;
      const sources: ConfirmedSource[] = [...currentDraft.confirmedSources];

      for (const [answerId, rawText] of answeredEntries(currentDraft)) {
        if (sources.some((source) => source.answerId === answerId)) continue;
        const operationId = currentDraft.reflectionOperationIds[answerId] ?? crypto.randomUUID();
        if (!currentDraft.reflectionOperationIds[answerId]) {
          currentDraft = commitDraft((current) => ({
            ...current,
            reflectionOperationIds: { ...current.reflectionOperationIds, [answerId]: operationId },
          }));
        }

        const currentWorkspace = runtime.current.store.load();
        const result = await runtime.current.adapter.saveReflection({
          operationId,
          expectedVersion: currentWorkspace.stateVersion,
          text: rawText.trim(),
        });
        if (!result.ok || !result.data) {
          setStatusMessage("Your words could not be saved. Check this page and try again.");
          return;
        }
        const source = { answerId, reflectionRef: result.data.reflection.ref, text: result.data.reflection.text };
        sources.push(source);
        currentDraft = commitDraft((current) => ({ ...current, confirmedSources: [...sources] }));
      }

      setStatusMessage("Saving your three route drafts…");
      const routeOperationId = currentDraft.routeOperationId ?? crypto.randomUUID();
      const routeRefs = currentDraft.routeRefs ?? createRouteRefs();
      if (!currentDraft.routeOperationId || !currentDraft.routeRefs) {
        currentDraft = commitDraft((current) => ({ ...current, routeOperationId, routeRefs }));
      }

      const currentWorkspace = runtime.current.store.load();
      const result = await runtime.current.adapter.proposeRouteSet({
        operationId: routeOperationId,
        expectedVersion: currentWorkspace.stateVersion,
        outcome: "routes",
        routes: createManualRoutes(
          sources,
          routeRefs,
          currentWorkspace,
          currentDraft.routeDrafts,
        ),
      });
      if (!result.ok) {
        setStatusMessage("The three routes could not be saved. Review your confirmed words and try again.");
        return;
      }
      if (result.data.outcome !== "routes") {
        setStatusMessage(result.data.followUpQuestion);
        return;
      }
      setWorkspace(runtime.current.store.load());
      commitDraft((current) => ({ ...current, screen: "routes" }));
      setStatusMessage("Your Route Room is ready. Nothing has been chosen for you.");
    } catch {
      setStatusMessage("The journey could not finish saving. Your place is still saved on this device.");
    } finally {
      setBusy(false);
    }
  }

  function updateMarks(routeRef: string, marks: RouteMarks) {
    commitDraft((current) => ({ ...current, marks: { ...current.marks, [routeRef]: marks } }));
  }

  function markRouteReviewed(routeRef: string) {
    commitDraft((current) => ({
      ...current,
      reviewedRoutes: { ...current.reviewedRoutes, [routeRef]: true },
    }));
  }

  function markComparisonSeen() {
    commitDraft((current) => ({ ...current, hasComparedRoutes: true }));
  }

  function ensureRuntimeCaps(caps: JourneyCaps): boolean {
    if (!runtime.current) return false;
    const current = runtime.current.store.load();
    if (sameCaps(current.participant.costCaps, caps)) return true;
    if (current.stateVersion !== 0 || localStorage.getItem(LOCAL_WORKSPACE_KEY) !== null) {
      setStatusMessage("These limits do not match the saved workspace. Start with a fresh local journey before building routes.");
      return false;
    }

    const store = new LocalWorkspaceStore(
      localStorage,
      createInitialWorkspace(caps),
      navigator.locks,
    );
    const adapter = createParticipantCommandAdapter(new CommandKernel(store));
    const workspaceReader = new WorkspaceReader(store);
    runtime.current = { store, adapter, reader: workspaceReader };
    setWorkspace(store.load());
    setReader(workspaceReader);
    return true;
  }

  async function editRoute(edit: RouteEdit): Promise<boolean> {
    if (!runtime.current || !latestRouteSet || busy) return false;
    setBusy(true);
    setStatusMessage("Saving your route changes…");
    try {
      const currentWorkspace = runtime.current.store.load();
      const result = await runtime.current.adapter.reviseRouteSet({
        operationId: crypto.randomUUID(),
        expectedVersion: currentWorkspace.stateVersion,
        routeSetRef: latestRouteSet.ref,
        edits: [edit],
      });
      if (!result.ok) {
        setStatusMessage("That edit did not change the route. Adjust the wording and save again.");
        return false;
      }
      setWorkspace(runtime.current.store.load());
      commitDraft((current) => {
        const reviewedRoutes = { ...current.reviewedRoutes };
        delete reviewedRoutes[edit.routeRef];
        return { ...current, reviewedRoutes, hasComparedRoutes: false };
      });
      setStatusMessage("Your route changes are saved.");
      return true;
    } catch {
      setStatusMessage("The route change could not be saved. Check this page and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function rejectRoute(routeRef: string): Promise<boolean> {
    if (!runtime.current || !latestRouteSet || busy) return false;
    setBusy(true);
    setStatusMessage("Setting that route aside…");
    try {
      const currentWorkspace = runtime.current.store.load();
      const result = await runtime.current.adapter.reviseRouteSet({
        operationId: crypto.randomUUID(),
        expectedVersion: currentWorkspace.stateVersion,
        routeSetRef: latestRouteSet.ref,
        rejectRouteRefs: [routeRef],
      });
      if (!result.ok) {
        setStatusMessage("That route could not be set aside. Refresh the page and try again.");
        return false;
      }
      const nextWorkspace = runtime.current.store.load();
      setWorkspace(nextWorkspace);
      commitDraft((current) => ({ ...current, hasComparedRoutes: false }));
      const nextSet = nextWorkspace.routeProposalSets.at(-1);
      if (nextSet?.routes.every((route) => route.status === "rejected")) {
        commitDraft((current) => ({ ...current, screen: "all-rejected" }));
      }
      setStatusMessage("The route is set aside. Your other routes have not changed.");
      return true;
    } catch {
      setStatusMessage("That route could not be set aside. Your other routes have not changed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function chooseRoute(routeRef: string) {
    if (!runtime.current || !latestRouteSet || busy) return;
    setBusy(true);
    setStatusMessage("Saving the direction you chose…");
    try {
      const currentWorkspace = runtime.current.store.load();
      const result = await runtime.current.adapter.chooseRoute({
        operationId: crypto.randomUUID(),
        expectedVersion: currentWorkspace.stateVersion,
        routeSetRef: latestRouteSet.ref,
        routeRef,
      });
      if (!result.ok) {
        setStatusMessage("Your choice could not be saved. Refresh the page and check the routes again.");
        return;
      }
      setWorkspace(runtime.current.store.load());
      commitDraft((current) => ({ ...current, screen: "chosen" }));
      setStatusMessage("Your direction is saved. Only the route you chose moves forward.");
    } catch {
      setStatusMessage("Your choice could not be saved. Your routes are still here.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="journey-app">
      <a className="skip-link" href="#journey-content">Skip to journey</a>
      <header className="site-header">
        <a className="wordmark" href="#journey-content" aria-label="Destiny.AI journey home">
          <span aria-hidden="true">D</span>
          Destiny.AI
        </a>
        <div className="site-header__actions">
          <WebMcpRegistrar reader={reader} />
          {ready && !["welcome", "saved", "chosen", "all-rejected", "routes"].includes(draft.screen) ? (
            <ActionButton onClick={saveAndExit} tone="quiet">Save and exit</ActionButton>
          ) : null}
        </div>
      </header>

      <div id="journey-content" className="journey-content">
        {!ready ? (
          <StepShell title="Opening your journey…"><div className="loading-block" aria-hidden="true" /></StepShell>
        ) : startupError ? (
          <StepShell eyebrow="Your saved work is protected" title="This journey needs a current browser" description={startupError}>
            <p className="recovery-note">Nothing was cleared or replaced.</p>
          </StepShell>
        ) : draft.screen === "welcome" ? (
          <StepShell eyebrow="A small direction lab" title={JOURNEY_COPY.promise} description={JOURNEY_COPY.intro}>
            <div className="welcome-card">
              <ol className="journey-preview" aria-label="What happens in this journey">
                <li><span>1</span><p><strong>Notice what is stuck</strong>Answer three focused questions in your own words.</p></li>
                <li><span>2</span><p><strong>See three routes</strong>Compare a close step, a bridge, and a small probe.</p></li>
                <li><span>3</span><p><strong>Choose one test</strong>Edit or reject every route before one moves forward.</p></li>
              </ol>
              <p className="privacy-note">{JOURNEY_COPY.privacy}</p>
              <ActionButton onClick={() => moveTo("shape")} tone="primary" fullWidth>{JOURNEY_COPY.start}</ActionButton>
            </div>
          </StepShell>
        ) : draft.screen === "shape" ? (
          <StepShell
            eyebrow="Start where you are"
            title="What shape does “stuck” have today?"
            description="Choose the closest fit. This only changes the next question; it does not label you."
            progress={<ProgressTrack current={0} total={3} label="Questions answered" />}
          >
            <fieldset className="choice-list">
              <legend className="sr-only">Choose the shape of stuck</legend>
              {STUCK_CHOICES.map((choice) => (
                <label key={choice.id} className="choice-card">
                  <input
                    name="stuck-shape"
                    type="radio"
                    checked={draft.shape === choice.id}
                    onChange={() => commitDraft((current) => ({ ...current, shape: choice.id }))}
                  />
                  <span><strong>{choice.title}</strong><small>{choice.description}</small></span>
                </label>
              ))}
            </fieldset>
            <div className="step-actions">
              <ActionButton onClick={goBack}>{JOURNEY_COPY.back}</ActionButton>
              <ActionButton disabled={!draft.shape} onClick={() => draft.shape && chooseShape(draft.shape)} tone="primary">
                {JOURNEY_COPY.continue}
              </ActionButton>
            </div>
          </StepShell>
        ) : draft.screen === "questions" ? (
          <QuestionStep
            draft={draft}
            question={questions[draft.questionIndex]}
            total={questions.length}
            statusMessage={statusMessage}
            onAnswer={(id, value) => commitDraft((current) => ({ ...current, answers: { ...current.answers, [id]: value } }))}
            onBack={goBack}
            onSkip={skipQuestion}
            onSubmit={submitAnswer}
          />
        ) : draft.screen === "confirm" ? (
          <ConfirmStep
            answer={answers[draft.confirmIndex]}
            current={draft.confirmIndex + 1}
            total={answers.length}
            statusMessage={statusMessage}
            onBack={goBack}
            onChange={(id, value) => commitDraft((current) => ({ ...current, answers: { ...current.answers, [id]: value } }))}
            onSubmit={confirmCurrentWording}
          />
        ) : draft.screen === "boundaries" ? (
          <BoundariesStep
            caps={draft.caps}
            onBack={() => moveTo("confirm")}
            onSubmit={saveCaps}
          />
        ) : draft.screen === "workshop" ? (
          <StepShell
            eyebrow="Shape the starter routes"
            title="Make these three drafts sound useful to you"
            description="These are plain starter templates, not AI recommendations. Rewrite the title, reason, question, or test before saving them to your Route Room."
            progress={<ProgressTrack current={answers.length} total={answers.length} label="Sources confirmed" />}
          >
            <div className="source-stack">
              {answers.map(([id, text]) => <blockquote key={id}>“{text}”</blockquote>)}
            </div>
            <div className="workshop-routes">
              {draft.routeDrafts.map((routeDraft, index) => (
                <fieldset className="workshop-route" key={ROUTE_KINDS[index]}>
                  <legend>{index + 1}. {ROUTE_KINDS[index] === "closest" ? "Closest" : ROUTE_KINDS[index] === "bridge" ? "Bridge" : "Probe"}</legend>
                  <label>Route title<input maxLength={120} required value={routeDraft.title} onChange={(event) => commitDraft((current) => ({ ...current, workshopReviewed: false, routeDrafts: replaceRouteDraft(current.routeDrafts, index, { title: event.target.value }) }))} /></label>
                  <label>Why it may be worth testing<textarea maxLength={600} required value={routeDraft.premise} onChange={(event) => commitDraft((current) => ({ ...current, workshopReviewed: false, routeDrafts: replaceRouteDraft(current.routeDrafts, index, { premise: event.target.value }) }))} /></label>
                  <label>What it should help you learn<textarea maxLength={300} required value={routeDraft.learningQuestion} onChange={(event) => commitDraft((current) => ({ ...current, workshopReviewed: false, routeDrafts: replaceRouteDraft(current.routeDrafts, index, { learningQuestion: event.target.value }) }))} /></label>
                  <label>Small test idea<textarea maxLength={500} required value={routeDraft.testAction} onChange={(event) => commitDraft((current) => ({ ...current, workshopReviewed: false, routeDrafts: replaceRouteDraft(current.routeDrafts, index, { testAction: event.target.value }) }))} /></label>
                </fieldset>
              ))}
            </div>
            <label className="review-check">
              <input
                checked={draft.workshopReviewed}
                onChange={(event) => commitDraft((current) => ({ ...current, workshopReviewed: event.target.checked }))}
                type="checkbox"
              />
              <span>I have read these three starter routes and they are ready for my Route Room.</span>
            </label>
            <div className="status-region" role="status" aria-live="polite" aria-atomic="true">{statusMessage}</div>
            <div className="step-actions">
              <ActionButton disabled={busy} onClick={() => moveTo("boundaries")}>{JOURNEY_COPY.back}</ActionButton>
              <ActionButton disabled={busy || !draft.workshopReviewed} onClick={buildRoutes} tone="primary">
                {busy ? "Saving my routes…" : "Save my three routes"}
              </ActionButton>
            </div>
          </StepShell>
        ) : draft.screen === "routes" && latestRouteSet ? (
          <RouteRoom
            routeSet={latestRouteSet}
            marks={draft.marks}
            busy={busy}
            statusMessage={statusMessage}
            reviewedRoutes={draft.reviewedRoutes}
            hasComparedRoutes={draft.hasComparedRoutes}
            onMarksChange={updateMarks}
            onReviewed={markRouteReviewed}
            onComparisonSeen={markComparisonSeen}
            onEdit={editRoute}
            onReject={rejectRoute}
            onChoose={chooseRoute}
          />
        ) : draft.screen === "chosen" && latestRouteSet && chosenHypothesis ? (
          <ChosenStep routeSet={latestRouteSet} statusMessage={statusMessage} />
        ) : draft.screen === "all-rejected" ? (
          <StepShell
            eyebrow="You kept control"
            title="You set all three routes aside"
            description="No direction moved forward. The routes stay in your local history so your decision remains clear."
          >
            <div className="completion-card">
              <p>That result is useful: the next set needs a different angle, not a forced choice.</p>
            </div>
          </StepShell>
        ) : draft.screen === "saved" ? (
          <StepShell
            eyebrow="Saved on this device"
            title="Your place is here when you return"
            description="Your answers and route marks remain in this browser."
          >
            <ActionButton onClick={resumeJourney} tone="primary" fullWidth>{JOURNEY_COPY.resume}</ActionButton>
          </StepShell>
        ) : null}
      </div>

      <footer className="site-footer">
        <p>Direction through small tests, not career prediction.</p>
        <p>Local to this browser.</p>
      </footer>
    </main>
  );
}

interface QuestionStepProps {
  draft: JourneyDraft;
  question: ReturnType<typeof questionsFor>[number] | undefined;
  total: number;
  statusMessage: string;
  onAnswer: (id: string, value: string) => void;
  onBack: () => void;
  onSkip: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function QuestionStep({ draft, question, total, statusMessage, onAnswer, onBack, onSkip, onSubmit }: QuestionStepProps) {
  if (!question) return null;
  return (
    <StepShell
      eyebrow={question.eyebrow}
      title={question.prompt}
      description={question.hint}
      progress={<ProgressTrack current={draft.questionIndex} total={total} label="Questions answered" />}
    >
      <form className="answer-form" onSubmit={onSubmit}>
        <label htmlFor={`answer-${question.id}`}>Your words</label>
        <textarea
          id={`answer-${question.id}`}
          autoFocus
          maxLength={500}
          placeholder={question.placeholder}
          required={!question.skippable}
          value={draft.answers[question.id] ?? ""}
          onChange={(event) => onAnswer(question.id, event.target.value)}
        />
        <div className="field-meta">
          <span>{question.skippable ? "Optional" : "Write at least one sentence"}</span>
          <span className="number">{(draft.answers[question.id] ?? "").length}/500</span>
        </div>
        <div className="status-region" role="status" aria-live="polite" aria-atomic="true">{statusMessage}</div>
        <div className="step-actions">
          <ActionButton onClick={onBack}>{JOURNEY_COPY.back}</ActionButton>
          <div className="step-actions__forward">
            {question.skippable ? <ActionButton onClick={onSkip} tone="quiet">{JOURNEY_COPY.skip}</ActionButton> : null}
            <ActionButton tone="primary" type="submit">{JOURNEY_COPY.continue}</ActionButton>
          </div>
        </div>
      </form>
    </StepShell>
  );
}

interface ConfirmStepProps {
  answer: [string, string] | undefined;
  current: number;
  total: number;
  statusMessage: string;
  onBack: () => void;
  onChange: (id: string, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function ConfirmStep({ answer, current, total, statusMessage, onBack, onChange, onSubmit }: ConfirmStepProps) {
  if (!answer) return null;
  return (
    <StepShell
      eyebrow="Check your source wording"
      title="Does this still sound like you?"
      description="Edit anything that feels too neat or not quite true. Your routes may quote these exact words."
      progress={<ProgressTrack current={Math.max(0, current - 1)} total={total} label="Sources confirmed" />}
    >
      <form className="answer-form answer-form--confirm" onSubmit={onSubmit}>
        <label htmlFor={`confirm-${answer[0]}`}>Words routes may quote</label>
        <textarea
          id={`confirm-${answer[0]}`}
          autoFocus
          maxLength={500}
          required
          value={answer[1]}
          onChange={(event) => onChange(answer[0], event.target.value)}
        />
        <p className="source-note">Only text you confirm here can appear as a quote in a route.</p>
        <div className="status-region" role="status" aria-live="polite" aria-atomic="true">{statusMessage}</div>
        <div className="step-actions">
          <ActionButton onClick={onBack}>{JOURNEY_COPY.back}</ActionButton>
          <ActionButton tone="primary" type="submit">{current === total ? "Use these words" : JOURNEY_COPY.continue}</ActionButton>
        </div>
      </form>
    </StepShell>
  );
}

function BoundariesStep({
  caps,
  onBack,
  onSubmit,
}: {
  caps: JourneyCaps | undefined;
  onBack: () => void;
  onSubmit: (caps: JourneyCaps) => void;
}) {
  const [hours, setHours] = useState(caps?.hoursPerWeek ? String(caps.hoursPerWeek) : "");
  const [money, setMoney] = useState(caps ? String(caps.money) : "0");
  const [currency, setCurrency] = useState(caps?.currency ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedHours = Number(hours);
    const parsedMoney = Number(money);
    const parsedCurrency = currency.trim().toUpperCase();
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      setError("Enter at least a small amount of time you could protect each week.");
      return;
    }
    if (!Number.isFinite(parsedMoney) || parsedMoney < 0) {
      setError("Enter zero or a positive money limit.");
      return;
    }
    if (!/^[A-Z]{3}$/.test(parsedCurrency)) {
      setError("Use a three-letter currency code such as INR, USD, or GBP.");
      return;
    }
    onSubmit({ hoursPerWeek: parsedHours, money: parsedMoney, currency: parsedCurrency });
  }

  return (
    <StepShell
      eyebrow="Keep the routes realistic"
      title="What limits should every small test respect?"
      description="These are hard ceilings, not targets. The Route Room will keep every starter test inside them."
    >
      <form className="answer-form boundary-form" onSubmit={submit}>
        <label htmlFor="hours-per-week">Time available each week</label>
        <div className="field-with-suffix">
          <input
            id="hours-per-week"
            inputMode="decimal"
            min="0.25"
            onChange={(event) => setHours(event.target.value)}
            required
            step="0.25"
            type="number"
            value={hours}
          />
          <span>hours</span>
        </div>
        <label htmlFor="money-limit">Maximum money for one test</label>
        <input
          id="money-limit"
          inputMode="decimal"
          min="0"
          onChange={(event) => setMoney(event.target.value)}
          required
          step="0.01"
          type="number"
          value={money}
        />
        <label htmlFor="currency-code">Currency</label>
        <input
          autoCapitalize="characters"
          id="currency-code"
          maxLength={3}
          onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          placeholder="INR"
          required
          value={currency}
        />
        <div className="status-region" role="status" aria-live="polite">{error}</div>
        <div className="step-actions">
          <ActionButton onClick={onBack}>{JOURNEY_COPY.back}</ActionButton>
          <ActionButton tone="primary" type="submit">Use these limits</ActionButton>
        </div>
      </form>
    </StepShell>
  );
}

function ChosenStep({ routeSet, statusMessage }: { routeSet: RouteProposalSet; statusMessage: string }) {
  const route = routeSet.routes.find((candidate) => candidate.ref === routeSet.selectedRouteRef);
  if (!route) return null;
  return (
    <StepShell
      eyebrow="One direction moves forward"
      title={`You chose “${route.title}” to test`}
      description="This is a direction to learn from, not a promise about your career. The other two routes remain ideas you did not choose."
    >
      <article className="completion-card">
        <p className="route-kind">Your small test</p>
        <h2>{route.test.action}</h2>
        <dl>
          <div><dt>What it should help you learn</dt><dd>{route.learningQuestion}</dd></div>
          <div><dt>Your boundary</dt><dd>{route.constraint}</dd></div>
          <div><dt>Grounded in your words</dt><dd>“{route.sourceQuotes[0]?.quote}”</dd></div>
        </dl>
      </article>
      <div className="status-region" role="status" aria-live="polite" aria-atomic="true">{statusMessage}</div>
      <p className="completion-note">Choosing saved this direction. Running and reviewing the test comes next.</p>
    </StepShell>
  );
}

function createRouteRefs(): [string, string, string] {
  const suffix = crypto.randomUUID().slice(0, 8);
  return ROUTE_KINDS.map((kind) => `route-${kind}-${suffix}`) as [string, string, string];
}

function createManualRoutes(
  sources: ConfirmedSource[],
  refs: [string, string, string],
  workspace: Workspace,
  routeDrafts: JourneyDraft["routeDrafts"],
): [RouteProposalInput, RouteProposalInput, RouteProposalInput] {
  const quoteSources = sources.slice(0, 5).map((source) => ({
    reflectionRef: source.reflectionRef,
    quote: source.text,
  }));
  const hours = workspace.participant.costCaps.hoursPerWeek;
  const money = workspace.participant.costCaps.money;
  const currency = workspace.participant.costCaps.currency;
  const boundary = `Keep the test within ${hours} hours a week and ${money} ${currency}, reversible, and small enough to stop within one week.`;
  const common = {
    sourceQuotes: quoteSources,
    constraint: boundary,
    strengthensWhen: "The test creates energy and a clear wish to learn more.",
    weakensWhen: "The test feels draining or teaches little worth pursuing.",
  };
  return [
    {
      ...common,
      ref: refs[0],
      kind: "closest",
      title: routeDrafts[0].title.trim(),
      premise: routeDrafts[0].premise.trim(),
      learningQuestion: routeDrafts[0].learningQuestion.trim(),
      test: {
        action: routeDrafts[0].testAction.trim(),
        maximumDays: 3,
        maximumHours: Math.min(hours, 1),
        maximumMoney: 0,
        currency,
      },
    },
    {
      ...common,
      ref: refs[1],
      kind: "bridge",
      title: routeDrafts[1].title.trim(),
      premise: routeDrafts[1].premise.trim(),
      learningQuestion: routeDrafts[1].learningQuestion.trim(),
      test: {
        action: routeDrafts[1].testAction.trim(),
        maximumDays: 5,
        maximumHours: Math.min(hours, 2),
        maximumMoney: 0,
        currency,
      },
    },
    {
      ...common,
      ref: refs[2],
      kind: "probe",
      title: routeDrafts[2].title.trim(),
      premise: routeDrafts[2].premise.trim(),
      learningQuestion: routeDrafts[2].learningQuestion.trim(),
      test: {
        action: routeDrafts[2].testAction.trim(),
        maximumDays: 7,
        maximumHours: Math.min(hours, 3),
        maximumMoney: 0,
        currency,
      },
    },
  ];
}

function replaceRouteDraft(
  drafts: JourneyDraft["routeDrafts"],
  index: number,
  changes: Partial<JourneyDraft["routeDrafts"][number]>,
): JourneyDraft["routeDrafts"] {
  return drafts.map((draft, currentIndex) =>
    currentIndex === index ? { ...draft, ...changes } : draft,
  ) as JourneyDraft["routeDrafts"];
}

function createInitialWorkspace(caps?: JourneyCaps): Workspace {
  const workspace = createEmptyWorkspace();
  if (!caps) return workspace;
  return {
    ...workspace,
    participant: {
      ...workspace.participant,
      costCaps: caps,
    },
  };
}

function sameCaps(left: JourneyCaps, right: JourneyCaps): boolean {
  return left.hoursPerWeek === right.hoursPerWeek &&
    left.money === right.money &&
    left.currency === right.currency;
}
