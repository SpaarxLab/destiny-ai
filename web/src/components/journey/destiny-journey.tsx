"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createParticipantCommandAdapter, type ParticipantCommandAdapter } from "../../adapters/participant-command-adapter";
import { CommandKernel } from "../../commands/command-kernel";
import type { RouteEdit, RouteProposalInput } from "../../domain/commands";
import type { RouteProposalSet, Workspace } from "../../domain/workspace";
import { createEmptyWorkspace } from "../../domain/workspace";
import { LocalWorkspaceStore } from "../../storage/local-workspace-store";
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

    const store = new LocalWorkspaceStore(localStorage, createEmptyWorkspace(), navigator.locks);
    const adapter = createParticipantCommandAdapter(new CommandKernel(store));
    const workspaceReader = new WorkspaceReader(store);
    runtime.current = { store, adapter, reader: workspaceReader };

    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const currentWorkspace = store.load();
        const savedDraft = parseJourneyDraft(localStorage.getItem(JOURNEY_DRAFT_KEY));
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
      moveTo("workshop");
    }
  }

  async function buildRoutes() {
    if (!runtime.current || busy) return;
    setBusy(true);
    setStatusMessage("Saving your confirmed words…");
    try {
      let currentDraft = draft;
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

      setStatusMessage("Shaping three different routes from your words…");
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
        routes: createManualRoutes(sources, routeRefs, currentWorkspace),
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
        ) : draft.screen === "workshop" ? (
          <StepShell
            eyebrow="Your words are ready"
            title="Build three routes to compare"
            description="This workshop shapes three different, reversible tests from the wording you just checked. You can edit or reject every route next."
            progress={<ProgressTrack current={answers.length} total={answers.length} label="Sources checked" />}
          >
            <div className="source-stack">
              {answers.map(([id, text]) => <blockquote key={id}>“{text}”</blockquote>)}
            </div>
            <div className="status-region" role="status" aria-live="polite" aria-atomic="true">{statusMessage}</div>
            <div className="step-actions">
              <ActionButton disabled={busy} onClick={() => moveTo("confirm")}>{JOURNEY_COPY.back}</ActionButton>
              <ActionButton disabled={busy} onClick={buildRoutes} tone="primary">
                {busy ? "Building my routes…" : "Build my three routes"}
              </ActionButton>
            </div>
          </StepShell>
        ) : draft.screen === "routes" && latestRouteSet ? (
          <RouteRoom
            routeSet={latestRouteSet}
            marks={draft.marks}
            busy={busy}
            statusMessage={statusMessage}
            onMarksChange={updateMarks}
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
      progress={<ProgressTrack current={current} total={total} label="Sources checked" />}
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
): [RouteProposalInput, RouteProposalInput, RouteProposalInput] {
  const quoteSources = sources.slice(0, 5).map((source) => ({
    reflectionRef: source.reflectionRef,
    quote: source.text,
  }));
  const boundary = "Keep the test free, reversible, and small enough to stop within one week.";
  const hours = workspace.participant.costCaps.hoursPerWeek;
  const currency = workspace.participant.costCaps.currency;
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
      title: "Use what already pulls you",
      premise: "A nearby direction may be hiding inside work you already return to without being pushed.",
      learningQuestion: "Does doing one real piece of this work create enough energy to repeat it?",
      test: {
        action: "Spend one short session doing the work, then note what gave or took energy.",
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
      title: "Combine the familiar and the new",
      premise: "A bridge may pair something you can already do with a nearby problem you want to understand.",
      learningQuestion: "Does combining these two parts feel more useful than pursuing either alone?",
      test: {
        action: "Sketch one tiny piece of work that combines both parts, and show it privately to one trusted person.",
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
      title: "Try a small departure",
      premise: "A careful probe may reveal whether a less familiar direction deserves more attention.",
      learningQuestion: "Does a low-stakes taste of this direction create curiosity strong enough for a second step?",
      test: {
        action: "Make one private sample or simulation of the unfamiliar work and record what surprised you.",
        maximumDays: 7,
        maximumHours: Math.min(hours, 3),
        maximumMoney: 0,
        currency,
      },
    },
  ];
}
