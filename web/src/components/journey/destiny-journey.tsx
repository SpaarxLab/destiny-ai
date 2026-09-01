"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createParticipantCommandAdapter, type ParticipantCommandAdapter } from "../../adapters/participant-command-adapter";
import { createWebMcpCommandAdapter, type WebMcpCommandAdapter } from "../../adapters/webmcp-command-adapter";
import { createEmbeddedCommandAdapter, type EmbeddedCommandAdapter } from "../../adapters/embedded-command-adapter";
import { CommandKernel } from "../../commands/command-kernel";
import type { RouteEdit, RouteProposalInput, RouteSlotInput } from "../../domain/commands";
import type { OrientationProjection } from "../../domain/reads";
import { createEmptyWorkspace, type Workspace } from "../../domain/workspace";
import { LOCAL_WORKSPACE_KEY, LocalWorkspaceStore } from "../../storage/local-workspace-store";
import { WorkspaceReader } from "../../projections/workspace-reader";
import {
  WebMcpRegistrar,
  agentCapabilityCopy,
  type AgentActivityEvent,
  type WebMcpRegistrationState,
} from "../../webmcp/registrar";
import { COPY, ROUTE_LABELS, questionsFor, type StuckShape } from "../../content/journey";
import { ActionButton } from "../primitives/action-button";
import { ConfirmDialog } from "../primitives/confirm-dialog";
import { Notice } from "../primitives/notice";
import { StepShell } from "../primitives/step-shell";
import { ActivityDrawer } from "../room/activity-drawer";
import { AgentViewPanel } from "../room/agent-view-panel";
import { RouteRoom } from "../room/route-room";
import type { WordSlip } from "../room/words-panel";
import { ChosenScreen } from "../screens/chosen-screen";
import { ConfirmWordsScreen } from "../screens/confirm-words-screen";
import { HandoffScreen, type AssistantStatus } from "../screens/handoff-screen";
import { LimitsScreen } from "../screens/limits-screen";
import { QuestionScreen } from "../screens/question-screen";
import { ShapeScreen } from "../screens/shape-screen";
import { WelcomeScreen } from "../screens/welcome-screen";
import { WorkshopScreen } from "../screens/workshop-screen";
import { ledgerSentences, type ActivityLine } from "./ledger-sentences";
import {
  JOURNEY_DRAFT_KEY,
  answeredEntries,
  emptyJourneyDraft,
  parseJourneyDraft,
  starterRouteDrafts,
  type ConfirmedSource,
  type JourneyDraft,
  type JourneyLimits,
  type JourneyScreen,
} from "./journey-state";

interface JourneyRuntime {
  store: LocalWorkspaceStore;
  kernel: CommandKernel;
  adapter: ParticipantCommandAdapter;
  webMcpAdapter: WebMcpCommandAdapter;
  embeddedAdapter: EmbeddedCommandAdapter;
  reader: WorkspaceReader;
}

const ROUTE_KINDS = ["closest", "bridge", "probe"] as const;

export function DestinyJourney() {
  const runtime = useRef<JourneyRuntime | null>(null);
  const draftRef = useRef<JourneyDraft>(emptyJourneyDraft());
  const presented = useRef(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [reader, setReader] = useState<WorkspaceReader | null>(null);
  const [webMcpAdapter, setWebMcpAdapter] = useState<WebMcpCommandAdapter | null>(null);
  const [draft, setDraft] = useState<JourneyDraft>(emptyJourneyDraft);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [agentEvents, setAgentEvents] = useState<AgentActivityEvent[]>([]);
  const [dismissedDenial, setDismissedDenial] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<"none" | "activity" | "agent-view">("none");
  const [startOverOpen, setStartOverOpen] = useState(false);
  const [assistant, setAssistant] = useState<AssistantStatus | null>(null);
  const [registration, setRegistration] = useState<WebMcpRegistrationState>({ status: "unsupported" });
  const agentConnected = registration.status === "registered";

  const questions = useMemo(() => (draft.shape ? questionsFor(draft.shape) : []), [draft.shape]);
  const answers = answeredEntries(draft);
  const latestRouteSet = workspace?.routeProposalSets.at(-1) ?? null;
  const proposedRouteSet = workspace?.routeProposalSets.find((set) => set.status === "proposed") ?? null;
  const openFollowUp = workspace?.followUpQuestions.find((question) => question.status === "proposed") ?? null;
  const acceptedHypothesis = workspace?.hypotheses.find((hypothesis) => hypothesis.status === "accepted") ?? null;
  const parkedHypothesis = workspace?.hypotheses.filter((hypothesis) => hypothesis.status === "parked").at(-1) ?? null;
  const words: WordSlip[] = useMemo(
    () => (workspace?.reflections ?? []).filter((reflection) => reflection.status === "confirmed").map((reflection) => ({ ref: reflection.ref, text: reflection.text })),
    [workspace],
  );
  const orientation: OrientationProjection | null = useMemo(() => {
    if (!reader || !workspace) return null;
    const result = reader.read({ view: "orientation" });
    return result.data?.view === "orientation" ? result.data : null;
  }, [reader, workspace]);

  // ---- boot ---------------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    if (!("locks" in navigator)) {
      queueMicrotask(() => {
        if (!cancelled) {
          setStartupError("This browser cannot save changes safely. Open the journey in a current browser.");
          setReady(true);
        }
      });
      return () => { cancelled = true; };
    }
    const savedDraft = parseJourneyDraft(localStorage.getItem(JOURNEY_DRAFT_KEY));
    const created = createRuntime();
    runtime.current = created;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const current = created.store.load();
        const nextDraft = { ...savedDraft, screen: resolveScreen(current, savedDraft) };
        draftRef.current = nextDraft;
        setDraft(nextDraft);
        setWorkspace(current);
        setReader(created.reader);
        setWebMcpAdapter(created.webMcpAdapter);
        setReady(true);
      } catch {
        setStartupError("Your saved room could not be opened. Its original copy is still on this device.");
        setReady(true);
      }
    });
    void fetch("/api/lab-assistant/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((status: AssistantStatus | null) => {
        if (!cancelled && status && typeof status.enabled === "boolean") {
          setAssistant({ enabled: status.enabled, label: typeof status.label === "string" ? status.label : COPY.assistantName });
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!presented.current) {
      presented.current = true;
      return;
    }
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("#journey-content h1")?.focus();
    });
  }, [ready, draft.screen, draft.questionIndex]);

  // ---- draft helpers ------------------------------------------------------------------------

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

  function refreshWorkspace(): Workspace | null {
    if (!runtime.current) return null;
    const current = runtime.current.store.load();
    setWorkspace(current);
    return current;
  }

  const syncFromWorkspace = useCallback((message?: string) => {
    if (!runtime.current) return;
    const current = runtime.current.store.load();
    setWorkspace(current);
    const screen = resolveScreen(current, draftRef.current);
    if (screen !== draftRef.current.screen) {
      const nextDraft = { ...draftRef.current, screen };
      draftRef.current = nextDraft;
      localStorage.setItem(JOURNEY_DRAFT_KEY, JSON.stringify(nextDraft));
      setDraft(nextDraft);
    }
    if (message) setStatusMessage(message);
  }, []);

  const handleWebMcpWorkspaceChanged = useCallback(() => {
    if (!runtime.current) return;
    const current = runtime.current.store.load();
    const latest = current.operations.at(-1);
    const proposedNow = current.routeProposalSets.find((set) => set.status === "proposed");
    const followUpNow = current.followUpQuestions.find((question) => question.status === "proposed");
    let message = "";
    if (latest?.command === "propose_route_set" && proposedNow && latest.changedRefs.includes(proposedNow.ref)) {
      message = proposedNow.routes.some((route) => route.carriedFromRouteRef)
        ? `${COPY.agentName} replaced the route you set aside. Your kept routes are unchanged.`
        : `${COPY.agentName} proposed three routes. Nothing has been chosen for you.`;
    } else if (followUpNow) {
      message = `${COPY.agentName} asked one question before proposing.`;
    }
    syncFromWorkspace(message);
  }, [syncFromWorkspace]);

  const handleWebMcpWorkspaceSyncError = useCallback(() => {
    setStatusMessage("A change was saved, but this screen could not refresh. Reload to see it.");
  }, []);

  const handleAgentActivity = useCallback((event: AgentActivityEvent) => {
    setAgentEvents((events) => [event, ...events].slice(0, 60));
  }, []);

  // ---- journey steps ------------------------------------------------------------------------

  function chooseShape(shape: StuckShape) {
    commitDraft((current) => {
      const same = current.shape === shape;
      return {
        ...current,
        shape,
        questionIndex: 0,
        answers: same ? current.answers : {},
        agentDrafted: same ? current.agentDrafted : {},
        screen: "questions",
      };
    });
  }

  function submitAnswer() {
    const question = questions[draft.questionIndex];
    if (!question) return;
    const answer = draft.answers[question.id]?.trim() ?? "";
    if (!answer && !question.skippable) {
      setStatusMessage("Write a sentence before you continue.");
      return;
    }
    if (draft.questionIndex < questions.length - 1) {
      commitDraft((current) => ({ ...current, questionIndex: current.questionIndex + 1 }));
    } else {
      moveTo("confirm");
    }
    setStatusMessage("");
  }

  function skipQuestion() {
    const question = questions[draft.questionIndex];
    if (!question?.skippable) return;
    commitDraft((current) => ({ ...current, answers: { ...current.answers, [question.id]: "" }, screen: "confirm" }));
    setStatusMessage("");
  }

  function goBack() {
    if (draft.screen === "questions") {
      if (draft.questionIndex === 0) moveTo("shape");
      else commitDraft((current) => ({ ...current, questionIndex: current.questionIndex - 1 }));
      return;
    }
    if (draft.screen === "confirm") {
      commitDraft((current) => ({ ...current, screen: "questions", questionIndex: Math.max(0, questions.length - 1) }));
      return;
    }
    if (draft.screen === "limits") moveTo("confirm");
    if (draft.screen === "shape") moveTo("welcome");
    if (draft.screen === "workshop") moveTo("handoff");
  }

  function confirmWords() {
    if (answers.length === 0) {
      setStatusMessage("Keep at least one sentence in your own words.");
      return;
    }
    moveTo("limits");
  }

  async function saveLimitsAndWords(limits: JourneyLimits) {
    if (!runtime.current || busy) return;
    setBusy(true);
    setStatusMessage("Saving…");
    try {
      let current = commitDraft((existing) => ({ ...existing, limits }));
      let ws = runtime.current.store.load();
      if (!sameLimits(ws.participant.costCaps, limits)) {
        const reuse = current.limitsOperation && sameLimits(current.limitsOperation.limits, limits)
          ? current.limitsOperation.operationId
          : crypto.randomUUID();
        current = commitDraft((existing) => ({ ...existing, limitsOperation: { operationId: reuse, limits } }));
        const result = await runtime.current.adapter.setLimits({
          operationId: reuse,
          expectedVersion: ws.stateVersion,
          costCaps: limits,
        });
        if (!result.ok) {
          setStatusMessage(result.error?.code === "POLICY_DENIED"
            ? "A route already in your room would break these limits. Set it aside first."
            : "Your limits could not be saved. Try again.");
          return;
        }
        ws = runtime.current.store.load();
      }
      const sources: ConfirmedSource[] = [...current.confirmedSources];
      for (const [answerId, text] of answeredEntries(current)) {
        const existing = sources.find((source) => source.answerId === answerId);
        if (existing && existing.text === text.trim()) continue;
        const operationId = existing ? crypto.randomUUID() : (current.reflectionOperationIds[answerId] ?? crypto.randomUUID());
        current = commitDraft((draftState) => ({
          ...draftState,
          reflectionOperationIds: { ...draftState.reflectionOperationIds, [answerId]: operationId },
        }));
        ws = runtime.current.store.load();
        const result = await runtime.current.adapter.saveReflection({
          operationId,
          expectedVersion: ws.stateVersion,
          text: text.trim(),
        });
        if (!result.ok || !result.data) {
          setStatusMessage("Your words could not be saved. Try again.");
          return;
        }
        const source = { answerId, reflectionRef: result.data.reflection.ref, text: result.data.reflection.text };
        const index = sources.findIndex((candidate) => candidate.answerId === answerId);
        if (index >= 0) sources[index] = source; else sources.push(source);
        current = commitDraft((draftState) => ({ ...draftState, confirmedSources: [...sources] }));
      }
      refreshWorkspace();
      commitDraft((draftState) => ({ ...draftState, screen: "handoff" }));
      setStatusMessage("");
    } catch {
      setStatusMessage("Saving did not finish. Your place is still on this device.");
    } finally {
      setBusy(false);
    }
  }

  function openWorkshop() {
    commitDraft((current) => ({
      ...current,
      screen: "workshop",
      routeOperationId: crypto.randomUUID(),
      routeRefs: createRouteRefs(),
      routeDrafts: current.routeDrafts,
    }));
    setStatusMessage("");
  }

  async function saveManualRoutes() {
    if (!runtime.current || busy || !draft.routeOperationId || !draft.routeRefs) return;
    setBusy(true);
    setStatusMessage("Saving your three routes…");
    try {
      const ws = runtime.current.store.load();
      const routes = manualRoutes(draft, words, ws);
      const result = await runtime.current.adapter.proposeRouteSet({
        operationId: draft.routeOperationId,
        expectedVersion: ws.stateVersion,
        outcome: "routes",
        routes,
        ...(ws.routeProposalSets.at(-1) ? { supersedesRouteSetRef: ws.routeProposalSets.at(-1)!.ref } : {}),
      });
      if (!result.ok) {
        setStatusMessage(`These drafts could not be saved: ${plainReason(result.error?.what)}`);
        return;
      }
      commitDraft((current) => ({ ...current, routeDrafts: starterRouteDrafts(), routeOperationId: undefined, routeRefs: undefined }));
      syncFromWorkspace("Your three routes are in the room. Nothing has been chosen for you.");
    } catch {
      setStatusMessage("Saving did not finish. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function askAssistant() {
    if (!runtime.current || busy || !orientation) return;
    setBusy(true);
    setStatusMessage("Asking the lab assistant…");
    try {
      const proposal = orientation.proposal;
      const response = await fetch("/api/lab-assistant/propose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirmedWords: orientation.confirmedWords.map((word) => ({ ref: word.ref, text: word.text })),
          costCaps: orientation.focus.costCaps,
          supersedesRouteSetRef: proposal.available ? proposal.supersedesRouteSetRef : null,
          carryRouteRefs: proposal.available ? proposal.carryRouteRefs : [],
          replaceKinds: proposal.available ? proposal.replaceKinds : [],
        }),
      });
      const body = await response.json() as
        | { outcome: "routes"; routes: [RouteSlotInput, RouteSlotInput, RouteSlotInput] }
        | { outcome: "insufficient_signal"; followUpQuestion: string; reasonRefs: string[] }
        | { outcome: "error"; code: string; message: string };
      if (body.outcome === "error") {
        setStatusMessage(`The lab assistant could not draft routes: ${plainReason(body.message)}`);
        return;
      }
      const ws = runtime.current.store.load();
      const predecessor = proposal.available ? proposal.supersedesRouteSetRef : null;
      const result = body.outcome === "insufficient_signal"
        ? await runtime.current.embeddedAdapter.proposeRouteSet({
            operationId: crypto.randomUUID(),
            expectedVersion: ws.stateVersion,
            outcome: "insufficient_signal",
            followUpQuestion: body.followUpQuestion,
            reasonRefs: body.reasonRefs,
          })
        : await runtime.current.embeddedAdapter.proposeRouteSet({
            operationId: crypto.randomUUID(),
            expectedVersion: ws.stateVersion,
            outcome: "routes",
            routes: body.routes,
            ...(predecessor ? { supersedesRouteSetRef: predecessor } : {}),
          });
      if (!result.ok) {
        setStatusMessage(`The lab assistant's draft was declined by your room: ${plainReason(result.error.what)}`);
        return;
      }
      syncFromWorkspace(body.outcome === "insufficient_signal"
        ? "The lab assistant asked one question before proposing."
        : "The lab assistant drafted three routes. Nothing has been chosen for you.");
    } catch {
      setStatusMessage("The lab assistant is not reachable right now. The other paths still work.");
    } finally {
      setBusy(false);
    }
  }

  // ---- room actions --------------------------------------------------------------------------

  async function editRoute(edit: RouteEdit): Promise<boolean> {
    if (!runtime.current || !proposedRouteSet || busy) return false;
    setBusy(true);
    try {
      const ws = runtime.current.store.load();
      const operationId = crypto.randomUUID();
      const kind = proposedRouteSet.routes.find((route) => route.ref === edit.routeRef)?.kind;
      const result = await runtime.current.adapter.reviseRouteSet({
        operationId,
        expectedVersion: ws.stateVersion,
        routeSetRef: proposedRouteSet.ref,
        edits: [edit],
      });
      if (!result.ok) {
        setStatusMessage(result.error?.code === "POLICY_DENIED" && result.error.what.includes("does not change")
          ? "Nothing changed, so nothing was saved."
          : `That edit could not be saved: ${plainReason(result.error?.what)}`);
        return false;
      }
      commitDraft((current) => ({ ...current, activityDetails: { ...current.activityDetails, [operationId]: `edited ${kind ? ROUTE_LABELS[kind].name : "a route"}` } }));
      syncFromWorkspace("Your changes are saved.");
      return true;
    } catch {
      setStatusMessage("That edit could not be saved. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function setAsideRoute(routeRef: string): Promise<boolean> {
    if (!runtime.current || !proposedRouteSet || busy) return false;
    setBusy(true);
    try {
      const ws = runtime.current.store.load();
      const operationId = crypto.randomUUID();
      const kind = proposedRouteSet.routes.find((route) => route.ref === routeRef)?.kind;
      const result = await runtime.current.adapter.reviseRouteSet({
        operationId,
        expectedVersion: ws.stateVersion,
        routeSetRef: proposedRouteSet.ref,
        rejectRouteRefs: [routeRef],
      });
      if (!result.ok) {
        setStatusMessage(`That route could not be set aside: ${plainReason(result.error?.what)}`);
        return false;
      }
      commitDraft((current) => ({ ...current, activityDetails: { ...current.activityDetails, [operationId]: `set aside ${kind ? ROUTE_LABELS[kind].name : "a route"}` } }));
      const after = runtime.current.store.load();
      const allAside = after.routeProposalSets.at(-1)?.routes.every((route) => route.status === "rejected");
      syncFromWorkspace(allAside
        ? "You set all three aside. No direction moved forward. You can ask for a new set or draft your own."
        : "Set aside. Your other routes are unchanged.");
      return true;
    } catch {
      setStatusMessage("That route could not be set aside. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function chooseRoute(routeRef: string) {
    if (!runtime.current || !proposedRouteSet || busy) return;
    setBusy(true);
    try {
      const ws = runtime.current.store.load();
      const result = await runtime.current.adapter.chooseRoute({
        operationId: crypto.randomUUID(),
        expectedVersion: ws.stateVersion,
        routeSetRef: proposedRouteSet.ref,
        routeRef,
      });
      if (!result.ok) {
        setStatusMessage(`Your choice could not be saved: ${plainReason(result.error?.what)}`);
        return;
      }
      syncFromWorkspace("Saved. Only the route you chose moves forward.");
    } catch {
      setStatusMessage("Your choice could not be saved. Your routes are still here.");
    } finally {
      setBusy(false);
    }
  }

  async function answerFollowUp(text: string) {
    if (!runtime.current || !openFollowUp || busy) return;
    setBusy(true);
    try {
      const ws = runtime.current.store.load();
      const result = await runtime.current.adapter.saveReflection({
        operationId: crypto.randomUUID(),
        expectedVersion: ws.stateVersion,
        text,
        answersFollowUpRef: openFollowUp.ref,
      });
      if (!result.ok) {
        setStatusMessage(`Your answer could not be saved: ${plainReason(result.error?.what)}`);
        return;
      }
      syncFromWorkspace(`Your answer is saved. ${COPY.agentName} can quote it in the next proposal.`);
    } finally {
      setBusy(false);
    }
  }

  async function skipFollowUp() {
    if (!runtime.current || !openFollowUp || busy) return;
    setBusy(true);
    try {
      const ws = runtime.current.store.load();
      const result = await runtime.current.adapter.skipFollowUp({
        operationId: crypto.randomUUID(),
        expectedVersion: ws.stateVersion,
        followUpRef: openFollowUp.ref,
      });
      if (!result.ok) {
        setStatusMessage(`The question could not be skipped: ${plainReason(result.error?.what)}`);
        return;
      }
      syncFromWorkspace("Skipped. Routes can be proposed from your words as they stand.");
    } finally {
      setBusy(false);
    }
  }

  async function reopenExploring() {
    if (!runtime.current || !acceptedHypothesis || busy) return;
    setBusy(true);
    try {
      const ws = runtime.current.store.load();
      const result = await runtime.current.adapter.reopenExploring({
        operationId: crypto.randomUUID(),
        expectedVersion: ws.stateVersion,
        hypothesisRef: acceptedHypothesis.ref,
      });
      if (!result.ok) {
        setStatusMessage(`Exploring could not be reopened: ${plainReason(result.error?.what)}`);
        return;
      }
      syncFromWorkspace("That direction is parked, not erased. New routes can be proposed.");
    } finally {
      setBusy(false);
    }
  }

  function exportRoom() {
    const raw = localStorage.getItem(LOCAL_WORKSPACE_KEY);
    if (!raw) {
      setStatusMessage("There is nothing saved to export yet.");
      return;
    }
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "destiny-room.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Your room was exported as a file.");
  }

  function startOver() {
    localStorage.removeItem(LOCAL_WORKSPACE_KEY);
    localStorage.removeItem(JOURNEY_DRAFT_KEY);
    const created = createRuntime();
    runtime.current = created;
    const fresh = emptyJourneyDraft();
    draftRef.current = fresh;
    setDraft(fresh);
    setWorkspace(created.store.load());
    setReader(created.reader);
    setWebMcpAdapter(created.webMcpAdapter);
    setAgentEvents([]);
    setStartOverOpen(false);
    setDrawer("none");
    setStatusMessage("");
  }

  // ---- derived view state --------------------------------------------------------------------

  const activityLines: ActivityLine[] = useMemo(() => {
    const ledger = workspace ? ledgerSentences(workspace, draft.activityDetails) : [];
    const session: ActivityLine[] = agentEvents
      .filter((event) => event.effect === "READ" || event.outcome !== "ok")
      .map((event) => ({
        id: event.id,
        at: event.at,
        actor: "agent" as const,
        sentence: event.summary,
        session: true,
        denied: event.outcome !== "ok",
      }));
    return [...session, ...ledger].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }, [workspace, draft.activityDetails, agentEvents]);

  const latestDenial = agentEvents.find((event) => event.outcome === "denied");
  const capabilityLine = agentCapabilityCopy(orientation, registration);
  const parkedNote = parkedHypothesis && !proposedRouteSet && !acceptedHypothesis
    ? `You parked “${parkedHypothesis.claim.slice(0, 80)}${parkedHypothesis.claim.length > 80 ? "…" : ""}”. A new set can be proposed now.`
    : null;
  const canResume = draft.screen !== "welcome" || answers.length > 0;
  const hasRoomHeader = ready && !startupError && (words.length > 0 || (workspace?.operations.length ?? 0) > 0);
  const receiptLine = latestReceiptLine(workspace);

  return (
    <main className="journey-app">
      <a className="skip-link" href="#journey-content">Skip to content</a>
      <header className="site-header">
        <a className="wordmark" href="#journey-content" aria-label="Destiny.AI home">
          <span aria-hidden="true">D</span>
          Destiny.AI
        </a>
        <div className="site-header__actions">
          {hasRoomHeader ? (
            <>
              <ActionButton
                aria-expanded={drawer === "activity"}
                onClick={() => setDrawer(drawer === "activity" ? "none" : "activity")}
                tone="quiet"
              >
                What happened
              </ActionButton>
              <ActionButton
                aria-expanded={drawer === "agent-view"}
                onClick={() => setDrawer(drawer === "agent-view" ? "none" : "agent-view")}
                tone="quiet"
              >
                See what ChatGPT sees
              </ActionButton>
              <ActionButton onClick={() => setStartOverOpen(true)} tone="quiet">
                {COPY.startOver}
              </ActionButton>
            </>
          ) : null}
          <WebMcpRegistrar
            commandAdapter={webMcpAdapter}
            onWorkspaceChanged={handleWebMcpWorkspaceChanged}
            onWorkspaceSyncError={handleWebMcpWorkspaceSyncError}
            onAgentActivity={handleAgentActivity}
            onRegistrationChanged={setRegistration}
            reader={reader}
            stateVersion={workspace?.stateVersion}
          />
        </div>
      </header>

      {latestDenial && dismissedDenial !== latestDenial.id ? (
        <div className="journey-notices">
          <Notice tone="warning" onDismiss={() => setDismissedDenial(latestDenial.id)}>
            {latestDenial.summary} Nothing changed.
          </Notice>
        </div>
      ) : null}

      <div id="journey-content" className="journey-content">
        {!ready ? (
          <StepShell title="Opening your room…"><div className="loading-block" aria-hidden="true" /></StepShell>
        ) : startupError ? (
          <StepShell eyebrow="Your saved work is protected" title="This room needs a current browser" description={startupError}>
            <p className="recovery-note">Nothing was cleared or replaced.</p>
          </StepShell>
        ) : draft.screen === "welcome" ? (
          <WelcomeScreen
            canResume={canResume}
            onStart={() => moveTo("shape")}
            onResume={() => syncFromWorkspace()}
            onStartOver={() => setStartOverOpen(true)}
          />
        ) : draft.screen === "shape" ? (
          <ShapeScreen
            shape={draft.shape}
            onSelect={(shape) => commitDraft((current) => ({ ...current, shape }))}
            onBack={goBack}
            onContinue={() => draft.shape && chooseShape(draft.shape)}
          />
        ) : draft.screen === "questions" && questions[draft.questionIndex] ? (
          <QuestionScreen
            question={questions[draft.questionIndex]}
            index={draft.questionIndex}
            total={questions.length}
            value={draft.answers[questions[draft.questionIndex].id] ?? ""}
            agentDrafted={draft.agentDrafted[questions[draft.questionIndex].id] === true}
            statusMessage={statusMessage}
            onChange={(value) => commitDraft((current) => ({
              ...current,
              answers: { ...current.answers, [questions[current.questionIndex].id]: value },
              agentDrafted: { ...current.agentDrafted, [questions[current.questionIndex].id]: false },
            }))}
            onAgentDraft={(value) => commitDraft((current) => ({
              ...current,
              answers: { ...current.answers, [questions[current.questionIndex].id]: value },
              agentDrafted: { ...current.agentDrafted, [questions[current.questionIndex].id]: true },
            }))}
            onBack={goBack}
            onSkip={skipQuestion}
            onSubmit={submitAnswer}
          />
        ) : draft.screen === "confirm" ? (
          <ConfirmWordsScreen
            answers={answers}
            agentDrafted={draft.agentDrafted}
            statusMessage={statusMessage}
            onChange={(id, value) => commitDraft((current) => ({
              ...current,
              answers: { ...current.answers, [id]: value },
              agentDrafted: { ...current.agentDrafted, [id]: false },
            }))}
            onBack={goBack}
            onSubmit={confirmWords}
          />
        ) : draft.screen === "limits" ? (
          <LimitsScreen
            limits={draft.limits}
            busy={busy}
            statusMessage={statusMessage}
            onBack={goBack}
            onSubmit={(limits) => void saveLimitsAndWords(limits)}
          />
        ) : draft.screen === "handoff" ? (
          <HandoffScreen
            words={words}
            limits={draft.limits ?? (workspace ? workspace.participant.costCaps : undefined)}
            capabilityLine={capabilityLine}
            agentConnected={agentConnected}
            parkedNote={parkedNote}
            assistant={assistant}
            assistantConsent={draft.assistantConsent}
            busy={busy}
            statusMessage={statusMessage}
            onConsentChange={(value) => commitDraft((current) => ({ ...current, assistantConsent: value }))}
            onAskAssistant={() => void askAssistant()}
            onDraftMyOwn={openWorkshop}
          />
        ) : draft.screen === "workshop" ? (
          <WorkshopScreen
            drafts={draft.routeDrafts}
            words={words}
            busy={busy}
            statusMessage={statusMessage}
            onChange={(index, changes) => commitDraft((current) => ({
              ...current,
              routeDrafts: current.routeDrafts.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item)) as JourneyDraft["routeDrafts"],
            }))}
            onBack={goBack}
            onSave={() => void saveManualRoutes()}
          />
        ) : draft.screen === "room" ? (
          <>
            {statusMessage ? <div className="status-region status-region--room" role="status" aria-live="polite" aria-atomic="true">{statusMessage}</div> : null}
            <RouteRoom
              routeSet={proposedRouteSet}
              followUp={openFollowUp}
              words={words}
              orientation={orientation}
              notes={draft.notes}
              busy={busy}
              onNotesChange={(routeRef, notes) => commitDraft((current) => ({ ...current, notes: { ...current.notes, [routeRef]: notes } }))}
              onEdit={editRoute}
              onSetAside={setAsideRoute}
              onChoose={chooseRoute}
              onAnswerFollowUp={answerFollowUp}
              onSkipFollowUp={skipFollowUp}
            />
          </>
        ) : draft.screen === "chosen" && latestRouteSet && acceptedHypothesis ? (
          <ChosenScreen
            routeSet={workspace!.routeProposalSets.find((set) => set.ref === acceptedHypothesis.originatingRouteSetRef) ?? latestRouteSet}
            hypothesis={acceptedHypothesis}
            receiptLine={receiptLine}
            busy={busy}
            statusMessage={statusMessage}
            onReopen={() => void reopenExploring()}
            onExport={exportRoom}
            onStartOver={() => setStartOverOpen(true)}
          />
        ) : (
          <WelcomeScreen
            canResume={false}
            onStart={() => moveTo("shape")}
            onResume={() => syncFromWorkspace()}
            onStartOver={() => setStartOverOpen(true)}
          />
        )}
      </div>

      <ActivityDrawer open={drawer === "activity"} lines={activityLines} onClose={() => setDrawer("none")} />
      <AgentViewPanel
        open={drawer === "agent-view"}
        json={orientation ? JSON.stringify(orientation, null, 2) : "{}"}
        onClose={() => setDrawer("none")}
      />

      <ConfirmDialog
        open={startOverOpen}
        title="Start over on this device?"
        confirmLabel="Clear and start over"
        onConfirm={startOver}
        onCancel={() => setStartOverOpen(false)}
      >
        <p>This removes your words, limits, routes, receipts, and private notes from this browser. Nothing else is stored anywhere.</p>
      </ConfirmDialog>

      <footer className="site-footer">
        <p>Direction through small tests, not prediction.</p>
        <p>{COPY.privacy}</p>
      </footer>
    </main>
  );
}

// ---- helpers -------------------------------------------------------------------------------

function createRuntime(): JourneyRuntime {
  const store = new LocalWorkspaceStore(localStorage, createEmptyWorkspace(), navigator.locks);
  const kernel = new CommandKernel(store);
  return {
    store,
    kernel,
    adapter: createParticipantCommandAdapter(kernel),
    webMcpAdapter: createWebMcpCommandAdapter(kernel),
    embeddedAdapter: createEmbeddedCommandAdapter(kernel),
    reader: new WorkspaceReader(store),
  };
}

function resolveScreen(workspace: Workspace, draft: JourneyDraft): JourneyScreen {
  if (workspace.hypotheses.some((hypothesis) => hypothesis.status === "accepted")) return "chosen";
  if (workspace.routeProposalSets.some((set) => set.status === "proposed")) return "room";
  if (workspace.followUpQuestions.some((question) => question.status === "proposed")) return "room";
  const hasWords = workspace.reflections.some((reflection) => reflection.status === "confirmed");
  if (hasWords) return draft.screen === "workshop" ? "workshop" : "handoff";
  if (["handoff", "workshop", "room", "chosen"].includes(draft.screen)) return "welcome";
  return draft.screen;
}

function sameLimits(left: JourneyLimits, right: JourneyLimits): boolean {
  return left.hoursPerWeek === right.hoursPerWeek && left.money === right.money && left.currency === right.currency;
}

function createRouteRefs(): [string, string, string] {
  const suffix = crypto.randomUUID().slice(0, 8);
  return ROUTE_KINDS.map((kind) => `route-${kind}-${suffix}`) as [string, string, string];
}

function manualRoutes(
  draft: JourneyDraft,
  words: WordSlip[],
  workspace: Workspace,
): [RouteProposalInput, RouteProposalInput, RouteProposalInput] {
  const refs = draft.routeRefs!;
  const caps = workspace.participant.costCaps;
  const hours = caps.hoursPerWeek;
  const quoteFor = (index: number) => {
    const word = words[index % Math.max(1, words.length)] ?? words[0];
    return [{ reflectionRef: word.ref, quote: word.text }];
  };
  const plans = [
    { days: 3, hours: Math.min(hours, 1), boundary: `One session, within ${Math.min(hours, 1)} hours, no spend, stop any time.` },
    { days: 5, hours: Math.min(hours, 2), boundary: `Within ${Math.min(hours, 2)} hours and ${caps.money} ${caps.currency}, private until you decide otherwise.` },
    { days: 7, hours: Math.min(hours, 3), boundary: `Within ${Math.min(hours, 3)} hours, no commitment, and reversible within a week.` },
  ];
  const strengthens = [
    "You want to repeat it the next day.",
    "The combination feels more useful than either half alone.",
    "The taste leaves you curious rather than relieved it is over.",
  ];
  const weakens = [
    "It drains you even when it goes well.",
    "Both halves feel forced together.",
    "You feel relief when the sample is finished.",
  ];
  return draft.routeDrafts.map((item, index) => ({
    ref: refs[index],
    kind: ROUTE_KINDS[index],
    title: item.title.trim(),
    premise: item.premise.trim(),
    sourceQuotes: quoteFor(index),
    constraint: plans[index].boundary,
    learningQuestion: item.learningQuestion.trim(),
    test: {
      action: item.testAction.trim(),
      maximumDays: plans[index].days,
      maximumHours: plans[index].hours,
      maximumMoney: 0,
      currency: caps.currency,
    },
    strengthensWhen: strengthens[index],
    weakensWhen: weakens[index],
  })) as [RouteProposalInput, RouteProposalInput, RouteProposalInput];
}

function latestReceiptLine(workspace: Workspace | null): string {
  const latest = workspace?.operations.at(-1);
  if (!latest) return "";
  return `Saved with receipt ${latest.afterVersion} · version ${latest.beforeVersion} to ${latest.afterVersion}`;
}

function plainReason(what: string | undefined): string {
  if (!what) return "something did not line up. Try again.";
  return what.replace(/\b(route-set-\d+|reflection-\d+|question-\d+)\b/g, "that item");
}
