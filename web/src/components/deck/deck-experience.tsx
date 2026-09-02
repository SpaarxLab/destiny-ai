"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ParticipantCommandAdapter } from "../../adapters/participant-command-adapter";
import type { WebMcpCommandAdapter } from "../../adapters/webmcp-command-adapter";
import { fixtureDeck } from "../../content/fixture-deck";
import type { AgentIdentity, Gesture, Swipe, Workspace } from "../../domain/workspace";
import { detectModelContext } from "../../webmcp/runtime";

const FIXTURE_DEALER: AgentIdentity = { source: "fixture", role: "dealer", label: "Fixture dealer" };
const FIXTURE_READER: AgentIdentity = { source: "fixture", role: "reader", label: "Fixture reader" };
const EMBEDDED_DEALER: AgentIdentity = { source: "embedded_inference", role: "dealer", label: "Embedded Dealer" };
const EMBEDDED_READER: AgentIdentity = { source: "embedded_inference", role: "reader", label: "Embedded Reader" };
const PILES: readonly { gesture: Gesture; label: string; hint: string }[] = [
  { gesture: "not_me", label: "Not me", hint: "←" },
  { gesture: "wish", label: "I wish", hint: "↑" },
  { gesture: "used_to", label: "I used to", hint: "↓" },
  { gesture: "me", label: "That's me", hint: "→" },
];

function monotonicNow() {
  return performance.now();
}

export function DeckExperience({ workspace, participant, agent, onChanged, agentConnected }: {
  workspace: Workspace;
  participant: ParticipantCommandAdapter;
  agent: WebMcpCommandAdapter;
  onChanged(message?: string): void;
  agentConnected: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [flippedCardRef, setFlippedCardRef] = useState<string | null>(null);
  const [pendingGesture, setPendingGesture] = useState<{ cardRef: string; gesture: Gesture } | null>(null);
  const [drag, setDrag] = useState({ cardRef: "", x: 0, y: 0, active: false });
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [limitHours, setLimitHours] = useState(Math.max(1, workspace.participant.costCaps.hoursPerWeek || 3));
  const [limitMoney, setLimitMoney] = useState(workspace.participant.costCaps.money);
  const cardRoot = useRef<HTMLElement>(null);
  const cardFront = useRef<HTMLDivElement>(null);
  const focusNextCard = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const shownAt = useRef(0);
  const orchestration = useRef(new Set<string>());
  const unresolved = workspace.cards.filter((card) => card.status === "dealt");
  const current = unresolved[0] ?? null;
  const flipped = current !== null && flippedCardRef === current.ref;
  const currentDrag = current !== null && drag.cardRef === current.ref ? drag : { cardRef: "", x: 0, y: 0, active: false };
  const openTension = workspace.tensions.find((tension) => tension.status === "proposed") ?? null;
  const resolvedTensions = workspace.tensions.filter((tension) => ["accepted", "edited", "survived"].includes(tension.status));
  const portrait = workspace.portraits.find((candidate) => candidate.status === "proposed") ?? null;
  const latestRejectedPortrait = [...workspace.portraits].reverse().find((candidate) => candidate.status === "rejected") ?? null;
  const hasSwipeAfterPortraitDeferral = !latestRejectedPortrait || workspace.swipes.some((swipe) => swipe.at > latestRejectedPortrait.createdAt);
  const counts = useMemo(() => Object.fromEntries(PILES.map((pile) => [pile.gesture, workspace.swipes.filter((swipe) => swipe.gesture === pile.gesture).length])) as Record<Gesture, number>, [workspace.swipes]);
  const reasonCount = workspace.swipes.filter((swipe) => swipe.tappedReasonIndex !== undefined).length;
  const slowCount = workspace.swipes.filter((swipe) => swipe.dwell === "slow").length;
  const recommendation = readerRecommendation(workspace.swipes.length, reasonCount, slowCount, Boolean(openTension), Boolean(portrait), flipped);

  useEffect(() => {
    shownAt.current = monotonicNow();
    if (focusNextCard.current) {
      focusNextCard.current = false;
      queueMicrotask(() => cardFront.current?.focus({ preventScroll: true }));
    }
  }, [current?.ref]);

  useEffect(() => {
    if (flipped) queueMicrotask(() => cardRoot.current?.querySelector<HTMLButtonElement>(".reason-choice")?.focus({ preventScroll: true }));
  }, [flipped]);

  const dealFixtures = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_DESTINY_FIXTURES !== "on" || detectModelContext() || busy || workspace.deck.dealsUnresolved >= 3 || workspace.swipes.length >= 5) return;
    const key = `deal-${workspace.cards.length}`;
    if (orchestration.current.has(key)) return;
    orchestration.current.add(key);
    const dealtTexts = new Set(workspace.cards.map((card) => card.text));
    const slots = Math.min(5 - workspace.deck.dealsUnresolved, 4);
    let cards = fixtureDeck.filter((card) => !dealtTexts.has(card.text)).slice(0, slots).map((card) => ({ ...card, kind: "moment" as const }));
    let dealer = FIXTURE_DEALER;
    if (workspace.deck.consentEmbedded) {
      try {
        const response = await fetch("/api/roles/deal", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            piles: Object.fromEntries(PILES.map(({ gesture }) => [gesture, workspace.swipes.filter((swipe) => swipe.gesture === gesture).map((swipe) => swipe.ref)])),
            dealtTexts: [...dealtTexts],
            slots,
            wanted: workspace.swipes.length === 0 ? "opening" : "any",
          }),
        });
        const generated = await response.json() as { ok?: boolean; value?: { cards?: typeof cards } };
        if (response.ok && generated.ok && generated.value?.cards?.length) {
          cards = generated.value.cards;
          dealer = EMBEDDED_DEALER;
        }
      } catch { /* the fixture tray remains authoritative fallback */ }
    }
    if (!cards.length) return;
    setBusy(true);
    const result = await agent.dealCards({ operationId: crypto.randomUUID(), expectedVersion: workspace.stateVersion, role: "dealer", cards: cards.map((card) => ({ ...card, reasons: [...card.reasons] as [string, string, string] })) }, dealer);
    setBusy(false);
    if (result.ok) onChanged(`${dealer.label} placed new moments on the table.`);
    else setMessage(result.error?.what ?? "The next cards could not be dealt.");
  }, [agent, busy, onChanged, workspace]);

  useEffect(() => { queueMicrotask(() => void dealFixtures()); }, [dealFixtures]);

  const maybeRead = useCallback(async () => {
    if (agentConnected || workspace.swipes.length < 12 || openTension || resolvedTensions.length >= 2) return;
    const key = `read-${workspace.swipes.length}-${workspace.tensions.length}`;
    if (orchestration.current.has(key)) return;
    const evidence = evidenceWindow(workspace, workspace.swipes, workspace.tensions.flatMap((tension) => tension.evidenceSwipeRefs));
    if (!evidence) { setMessage("The Reader needs one slow swipe or an opposite-pole contradiction. Keep dealing honestly."); return; }
    orchestration.current.add(key);
    let axis = workspace.cards.find((card) => card.ref === evidence[0].cardRef)?.axis ?? "making_deciding";
    const claims = [
      "You light up when the work is yours to shape, but pull back when its outcome becomes yours to carry.",
      "You want to be useful where people can feel it, yet protect the quiet space where your best work happens.",
    ];
    let claim = claims[workspace.tensions.length % claims.length];
    let evidenceSwipeRefs = evidence.map((swipe) => swipe.ref);
    let reader = FIXTURE_READER;
    if (workspace.deck.consentEmbedded) {
      try {
        const response = await fetch("/api/roles/read", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            swipes: workspace.swipes.map((swipe) => {
              const card = workspace.cards.find((candidate) => candidate.ref === swipe.cardRef);
              return { ref: swipe.ref, cardText: card?.text ?? "", axis: card?.axis ?? "making_deciding", pole: card?.pole ?? "a", gesture: swipe.gesture, dwell: swipe.dwell };
            }),
            existingTensions: workspace.tensions.map((tension) => tension.claim),
          }),
        });
        const generated = await response.json() as { ok?: boolean; value?: { outcome?: string; tension?: { claim: string; axis: typeof axis; evidenceSwipeRefs: string[] } } };
        if (response.ok && generated.ok && generated.value?.outcome === "tension" && generated.value.tension) {
          ({ claim, axis, evidenceSwipeRefs } = generated.value.tension);
          reader = EMBEDDED_READER;
        }
      } catch { /* a deterministic Reader remains available */ }
    }
    const result = await agent.proposeTension({ operationId: crypto.randomUUID(), expectedVersion: workspace.stateVersion, role: "reader", claim, axis, evidenceSwipeRefs }, reader);
    if (result.ok) onChanged("The Reader found a tension worth checking."); else setMessage(result.error?.what ?? "The Reader is waiting for clearer evidence.");
  }, [agent, agentConnected, onChanged, openTension, resolvedTensions.length, workspace]);

  useEffect(() => { queueMicrotask(() => void maybeRead()); }, [maybeRead]);

  useEffect(() => {
    if (agentConnected || resolvedTensions.length < 2 || portrait || !hasSwipeAfterPortraitDeferral) return;
    const key = `portrait-${resolvedTensions.map((tension) => tension.ref).join("-")}-${workspace.portraits.length}-${workspace.swipes.length}`;
    if (orchestration.current.has(key)) return;
    orchestration.current.add(key);
    void agent.proposePortrait({ operationId: crypto.randomUUID(), expectedVersion: workspace.stateVersion, role: "reader", tensionRefs: resolvedTensions.slice(0, 3).map((tension) => tension.ref) }, FIXTURE_READER).then((result) => {
      if (result.ok) onChanged("Your Portrait is ready to review."); else setMessage(result.error?.what ?? "The Portrait could not be prepared.");
    });
  }, [agent, agentConnected, hasSwipeAfterPortraitDeferral, onChanged, portrait, resolvedTensions, workspace.portraits.length, workspace.stateVersion, workspace.swipes.length]);

  async function commitSwipe(gesture: Gesture, tappedReasonIndex?: 0 | 1 | 2, skipReasonPrompt = false) {
    if (!current || busy) return;
    if (!skipReasonPrompt && current.reasons && tappedReasonIndex === undefined && (flipped || monotonicNow() - shownAt.current > 3_000)) {
      setPendingGesture({ cardRef: current.ref, gesture }); setFlippedCardRef(current.ref); return;
    }
    setBusy(true);
    const elapsed = monotonicNow() - shownAt.current;
    const dwell = !workspace.deck.dwellTracking ? "off" : elapsed < 1_200 ? "fast" : elapsed <= 3_000 ? "medium" : "slow";
    const result = await participant.swipeCard({ operationId: crypto.randomUUID(), expectedVersion: workspace.stateVersion, cardRef: current.ref, gesture, dwell, flipped, ...(tappedReasonIndex !== undefined ? { tappedReasonIndex } : {}) });
    setBusy(false);
    if (result.ok) {
      focusNextCard.current = true;
      onChanged(`${PILES.find((pile) => pile.gesture === gesture)?.label} · receipt saved.`);
      try {
        navigator.vibrate?.(8);
      } catch {
        // Haptics are optional; a device quirk must never hide a committed receipt.
      }
    }
    else setMessage(result.error?.what ?? "That swipe did not save.");
  }

  function handleCardKey(event: React.KeyboardEvent<HTMLElement>) {
    if (!current || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const gesture = event.key === "ArrowRight" ? "me" : event.key === "ArrowLeft" ? "not_me" : event.key === "ArrowUp" ? "wish" : event.key === "ArrowDown" ? "used_to" : null;
    if (gesture) { event.preventDefault(); void commitSwipe(gesture); return; }
    if ((event.key === " " || event.key === "Enter") && event.target === cardFront.current) {
      event.preventDefault();
      setFlippedCardRef((value) => value === current.ref ? null : current.ref);
      return;
    }
    if (flipped && ["1", "2", "3"].includes(event.key)) {
      event.preventDefault();
      void commitSwipe(pendingGesture?.cardRef === current.ref ? pendingGesture.gesture : "me", (Number(event.key) - 1) as 0 | 1 | 2);
    }
  }

  async function resolveTension(resolution: "accept" | "edit" | "reject") {
    if (!openTension) return;
    const result = await participant.resolveTension({ operationId: crypto.randomUUID(), expectedVersion: workspace.stateVersion, tensionRef: openTension.ref, resolution, ...(resolution === "edit" ? { claim: editText } : {}) });
    if (result.ok) { setEditing(null); onChanged(`Tension ${resolution === "accept" ? "kept" : resolution === "edit" ? "rewritten" : "set aside"}.`); }
    else setMessage(result.error?.what ?? "That decision did not save.");
  }

  async function updateDeckSettings(settings: { consentEmbedded?: boolean; dwellTracking?: boolean }) {
    const result = await participant.setDeckSettings({ operationId: crypto.randomUUID(), expectedVersion: workspace.stateVersion, ...settings });
    if (result.ok) onChanged(); else setMessage(result.error?.what ?? "That setting did not save.");
  }

  async function saveLimits() {
    const currency = workspace.participant.costCaps.currency === "XXX" ? "USD" : workspace.participant.costCaps.currency;
    const result = await participant.setLimits({ operationId: crypto.randomUUID(), expectedVersion: workspace.stateVersion, costCaps: { hoursPerWeek: limitHours, money: limitMoney, currency } });
    if (result.ok) onChanged("Your experiment limits are confirmed. ChatGPT must stay inside them.");
    else setMessage(result.error?.what ?? "Those limits could not be saved.");
  }

  async function dismissDealerNote(noteRef: string) {
    const result = await participant.dismissNote({ operationId: crypto.randomUUID(), expectedVersion: workspace.stateVersion, noteRef });
    if (result.ok) onChanged("Dealer note dismissed."); else setMessage(result.error?.what ?? "That note could not be dismissed.");
  }

  return (
    <section className="deck-shell" aria-label="ChatGPT A/B Tests Your Future">
      <div className="deck-intro"><p>Interactive evidence, not a career prediction.</p><h1 tabIndex={-1}>ChatGPT A/B Tests Your Future</h1></div>
      <header className="chairs-strip">
        <span><strong>You</strong> · only you respond and decide</span>
        <span><strong>ChatGPT</strong> · {agentConnected ? "conducting this test through WebMCP" : "open this page from ChatGPT to begin"}</span>
      </header>

      <div className="deck-consent">
        <p>{agentConnected ? "ChatGPT stages each situation. Your reaction is saved as a versioned receipt and returned only when ChatGPT inspects the room." : "There is no autonomous mode or chatbot on this page. In ChatGPT, ask it to open Destiny and test one direction worth exploring."}</p>
        <label><input type="checkbox" checked={workspace.deck.dwellTracking} onChange={(event) => void updateDeckSettings({ dwellTracking: event.target.checked })} /> Include hesitation as evidence</label>
        <div className="probe-limits" role="group" aria-label="Seven-day experiment limits"><strong>Your limits</strong><label>Hours this week <input type="number" min="0.5" max="168" step="0.5" value={limitHours} onChange={(event) => setLimitHours(Number(event.target.value))} /></label><label>Money ({workspace.participant.costCaps.currency === "XXX" ? "USD" : workspace.participant.costCaps.currency}) <input type="number" min="0" step="1" value={limitMoney} onChange={(event) => setLimitMoney(Number(event.target.value))} /></label><button type="button" onClick={() => void saveLimits()}>Confirm limits</button></div>
      </div>

      <section className="reader-guide" aria-labelledby="reader-guide-title">
        <div className="reader-guide__copy"><p className="reader-guide__eyebrow">How the experiment works <span>ChatGPT + your receipts</span></p><h2 id="reader-guide-title">{current?.probe?.uncertainty ?? recommendation.title}</h2><p>{current?.probe ? `ChatGPT changed: ${current.probe.changedVariable}. This would strengthen the idea if ${current.probe.strengthensWhen}; weaken it if ${current.probe.weakensWhen}.` : recommendation.detail}</p><small>ChatGPT can stage and interpret. It cannot answer, confirm evidence, choose a route, or commit for you.</small></div>
        <div className="reader-guide__signal"><div className="reader-guide__meter"><span>Probe evidence</span><strong>{Math.min(workspace.swipes.length, 5)} / 5 max</strong><div role="progressbar" aria-label="Probe evidence" aria-valuemin={0} aria-valuemax={5} aria-valuenow={Math.min(workspace.swipes.length, 5)}><i style={{ width: `${Math.min(100, workspace.swipes.length / 5 * 100)}%` }} /></div></div><p><span>{reasonCount} reasons</span><span>{slowCount} slow</span></p>{current ? <button type="button" onClick={() => setFlippedCardRef((value) => value === current.ref ? null : current.ref)}>{flipped ? "Return to the situation" : "See why this tests the idea"}</button> : null}</div>
      </section>

      {workspace.dealerNotes.some((note) => note.status === "visible") ? <section className="dealer-notes" aria-label="Dealer notes">{workspace.dealerNotes.filter((note) => note.status === "visible").map((note) => <article key={note.ref}><div><p>{note.postedBy.label}</p><blockquote>{note.text}</blockquote></div><button type="button" aria-label={`Dismiss note from ${note.postedBy.label}`} onClick={() => void dismissDealerNote(note.ref)}>Dismiss</button></article>)}</section> : null}

      <div className="table-grid">
        <aside className="pile-bank pile-bank--left">{PILES.slice(0, 3).map((pile) => <Pile key={pile.gesture} {...pile} count={counts[pile.gesture]} />)}</aside>
        <div className="card-stage">
          <p className="deck-kicker">{current ? `Probe ${Math.min(5, workspace.swipes.length + 1)} of 5 max · ${current.probe?.template.replaceAll("_", " ") ?? current.kind}` : agentConnected ? "Ask ChatGPT to stage the next probe" : "Continue from ChatGPT"}</p>
          {current ? (
            <article
              ref={cardRoot}
              className={`moment-card axis-${current.axis} ${flipped ? "is-flipped" : ""}`}
              style={{ transform: `translate3d(${currentDrag.x}px, ${currentDrag.y}px, 0) rotate(${currentDrag.x / 25}deg)` }}
              onClick={() => !currentDrag.active && setFlippedCardRef((value) => value === current.ref ? null : current.ref)}
              onKeyDown={handleCardKey}
              onPointerDown={(event) => {
                if (event.target instanceof Element && event.target.closest(".moment-card__back button")) return;
                cardFront.current?.focus({ preventScroll: true });
                pointerStart.current = { x: event.clientX, y: event.clientY };
                dragOffset.current = { x: 0, y: 0 };
                event.currentTarget.setPointerCapture(event.pointerId);
                setDrag({ cardRef: current.ref, x: 0, y: 0, active: false });
              }}
              onPointerMove={(event) => { if (!pointerStart.current) return; const offset = { x: event.clientX - pointerStart.current.x, y: event.clientY - pointerStart.current.y }; dragOffset.current = offset; setDrag({ cardRef: current.ref, ...offset, active: true }); }}
              onPointerUp={() => { const { x, y } = dragOffset.current; const gesture = Math.abs(x) > Math.abs(y) ? (x > 80 ? "me" : x < -80 ? "not_me" : null) : (y < -80 ? "wish" : y > 80 ? "used_to" : null); pointerStart.current = null; dragOffset.current = { x: 0, y: 0 }; if (gesture) void commitSwipe(gesture); else setDrag({ cardRef: current.ref, x: 0, y: 0, active: false }); }}
              onPointerCancel={() => { pointerStart.current = null; dragOffset.current = { x: 0, y: 0 }; setDrag({ cardRef: current.ref, x: 0, y: 0, active: false }); }}
            >
              <div ref={cardFront} className="moment-card__front" role="button" tabIndex={flipped ? -1 : 0} aria-hidden={flipped} aria-label={`Moment card: ${current.text}. Press Enter to show why choices, or use an arrow key to sort it.`}><span className="card-agent">{current.dealtBy.label}</span><p>{current.text}</p><span className="flip-cue">Tap to ask why</span></div>
              <div className="moment-card__back" aria-hidden={!flipped}><span className="card-agent">What caught you?</span>{current.reasons?.map((reason, index) => <button className="reason-choice" tabIndex={flipped ? 0 : -1} key={reason} onClick={(event) => { event.stopPropagation(); void commitSwipe(pendingGesture?.cardRef === current.ref ? pendingGesture.gesture : "me", index as 0 | 1 | 2); }}>{reason}</button>)}<button className="reason-none" tabIndex={flipped ? 0 : -1} onClick={(event) => { event.stopPropagation(); void commitSwipe(pendingGesture?.cardRef === current.ref ? pendingGesture.gesture : "me", undefined, true); }}>None of these</button></div>
            </article>
          ) : <div className="empty-table">{busy ? "Staging the next probe…" : agentConnected ? `ChatGPT is connected. Ask it to ${workspace.swipes.length ? "continue from your latest receipt" : "stage the first probe"}.` : "Open this page from ChatGPT to begin."}</div>}
          <div className="gesture-cross" aria-label="Swipe directions"><span>← not me</span><span>↑ I wish</span><span>↓ I used to</span><span>that&apos;s me →</span></div>
        </div>
        <aside className="pile-bank pile-bank--mobile" aria-label="Your four piles">{PILES.map((pile) => <Pile key={pile.gesture} {...pile} count={counts[pile.gesture]} />)}</aside>
        <aside className="tension-rail">
          <Pile {...PILES[3]} count={counts.me} />
          <h2>Hypotheses</h2>
          {workspace.tensions.filter((tension) => tension.status !== "rejected" && tension.status !== "superseded").map((tension) => <article key={tension.ref} className={`tension-card tension-card--${tension.status}`}><p>{tension.claim}</p><small>{tension.evidenceSwipeRefs.length} swipes · {tension.status}</small></article>)}
          {!workspace.tensions.length ? <p className="rail-empty">After enough contrasting receipts, ChatGPT proposes a falsifiable idea—not a type.</p> : null}
        </aside>
      </div>

      {openTension ? <DeckDialog className="decision-sheet" labelledBy="tension-dialog-title"><p id="tension-dialog-title" className="sheet-eyebrow">ChatGPT · {openTension.interpretation === "initial" ? "falsifiable hypothesis" : `${openTension.interpretation} its interpretation`}</p>{editing === openTension.ref ? <><label className="field-label" htmlFor="tension-edit">Rewrite this hypothesis in your words</label><textarea id="tension-edit" value={editText} onChange={(event) => setEditText(event.target.value)} /></> : <h2>{openTension.claim}</h2>}<p>{openTension.evidenceSwipeRefs.length} supporting swipe receipts · {openTension.contradictorySwipeRefs.length} contradictory receipts.</p>{openTension.supersedesTensionRef ? <p><strong>What changed:</strong> ChatGPT {openTension.interpretation} its earlier hypothesis after the counterexample.</p> : null}<div className="sheet-actions">{editing ? <button onClick={() => void resolveTension("edit")}>Save rewritten hypothesis</button> : <><button onClick={() => void resolveTension("accept")}>Keep as a working hypothesis</button><button onClick={() => { setEditing(openTension.ref); setEditText(openTension.claim); }}>Rewrite</button><button onClick={() => void resolveTension("reject")}>Reject hypothesis</button></>}</div></DeckDialog> : null}
      <p className="deck-status" role="status">{message}</p>
      <p className="deck-shortcuts">← → ↑ ↓ swipe · space flip · 1 2 3 tap a reason</p>
    </section>
  );
}

function Pile({ label, hint, count }: { label: string; hint: string; count: number }) {
  return <div className="pile"><span>{hint} {label}</span><strong>{count}</strong><div aria-hidden="true">{Array.from({ length: Math.min(count, 8) }, (_, index) => <i key={index} />)}</div></div>;
}

function DeckDialog({ className, labelledBy, children }: { className: string; labelledBy: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    return () => { if (node?.open) node.close(); };
  }, []);
  return <dialog ref={dialog} className={className} aria-labelledby={labelledBy} onCancel={(event) => event.preventDefault()}>{children}</dialog>;
}

function readerRecommendation(swipes: number, reasons: number, slow: number, hasOpenTension: boolean, hasPortrait: boolean, flipped: boolean) {
  if (hasPortrait) return { title: "Keep only what helps you decide.", detail: "Treat every synthesis as a working lens, never an identity." };
  if (hasOpenTension) return { title: "Treat ChatGPT's hypothesis as a draft.", detail: "Keep it, rewrite it in your language, or reject it. ChatGPT never gets the final word." };
  if (swipes >= 5) return { title: "Enough evidence for the next decision.", detail: "Ask ChatGPT to inspect the receipts and move the experiment forward." };
  if (swipes >= 6) return { title: "Pressure-test your biggest pile.", detail: "Do not chase balance. Notice whether the next moment belongs there on instinct or needs a reason." };
  if (swipes > 0) return { title: reasons === 0 ? "Add one piece of evidence." : "Mix instinct with evidence.", detail: flipped ? "Choose the reason that actually caught you, or skip all three without penalty." : "Turn over one card when you want to name what caught you. Fast swipes still count." };
  return { title: "Trust the first reaction.", detail: slow > 0 ? "The pause is evidence, but the response is still yours." : "Respond on instinct. Turn a card over only when you want to name why it caught you." };
}

function evidenceWindow(workspace: Workspace, swipes: Swipe[], excludedRefs: string[]): Swipe[] | null {
  const candidates = swipes.filter((swipe) => !excludedRefs.includes(swipe.ref));
  const slow = candidates.find((swipe) => swipe.dwell === "slow");
  if (slow) return [slow, ...candidates.filter((swipe) => swipe.ref !== slow.ref).slice(-2)];
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
    const left = candidates[leftIndex]; const right = candidates[rightIndex];
    const leftCard = workspace.cards.find((card) => card.ref === left.cardRef); const rightCard = workspace.cards.find((card) => card.ref === right.cardRef);
    if (leftCard && rightCard && leftCard.axis === rightCard.axis && leftCard.pole !== rightCard.pole && ((left.gesture === "me" && right.gesture === "me") || new Set([left.gesture, right.gesture]).has("wish") && new Set([left.gesture, right.gesture]).has("me"))) {
      const third = candidates.find((swipe) => swipe.ref !== left.ref && swipe.ref !== right.ref);
      if (third) return [left, right, third];
    }
  }
  return null;
}
