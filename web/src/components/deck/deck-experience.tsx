"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ParticipantCommandAdapter } from "../../adapters/participant-command-adapter";
import type { WebMcpCommandAdapter } from "../../adapters/webmcp-command-adapter";
import { fixtureDeck } from "../../content/fixture-deck";
import type { AgentIdentity, Gesture, Swipe, Workspace } from "../../domain/workspace";

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
    if (busy || workspace.deck.dealsUnresolved >= 3 || workspace.swipes.length >= 16) return;
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
    if (workspace.swipes.length < 12 || openTension || resolvedTensions.length >= 2) return;
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
  }, [agent, onChanged, openTension, resolvedTensions.length, workspace]);

  useEffect(() => { queueMicrotask(() => void maybeRead()); }, [maybeRead]);

  useEffect(() => {
    if (resolvedTensions.length < 2 || portrait || !hasSwipeAfterPortraitDeferral) return;
    const key = `portrait-${resolvedTensions.map((tension) => tension.ref).join("-")}-${workspace.portraits.length}-${workspace.swipes.length}`;
    if (orchestration.current.has(key)) return;
    orchestration.current.add(key);
    void agent.proposePortrait({ operationId: crypto.randomUUID(), expectedVersion: workspace.stateVersion, role: "reader", tensionRefs: resolvedTensions.slice(0, 3).map((tension) => tension.ref) }, FIXTURE_READER).then((result) => {
      if (result.ok) onChanged("Your Portrait is ready to review."); else setMessage(result.error?.what ?? "The Portrait could not be prepared.");
    });
  }, [agent, hasSwipeAfterPortraitDeferral, onChanged, portrait, resolvedTensions, workspace.portraits.length, workspace.stateVersion, workspace.swipes.length]);

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

  async function resolvePortrait(resolution: "accept" | "reject") {
    if (!portrait) return;
    const result = await participant.resolvePortrait({ operationId: crypto.randomUUID(), expectedVersion: workspace.stateVersion, portraitRef: portrait.ref, resolution });
    if (result.ok) onChanged(resolution === "accept" ? "Portrait kept. Now set the limits for your routes." : "Portrait set aside. One more honest card will invite a fresh review.");
    else setMessage(result.error?.what ?? "That Portrait decision did not save.");
  }

  async function dismissDealerNote(noteRef: string) {
    const result = await participant.dismissNote({ operationId: crypto.randomUUID(), expectedVersion: workspace.stateVersion, noteRef });
    if (result.ok) onChanged("Dealer note dismissed."); else setMessage(result.error?.what ?? "That note could not be dismissed.");
  }

  return (
    <section className="deck-shell" aria-label="The Deck">
      <div className="deck-intro"><p>One minute. No typing. No type assigned.</p><h1 tabIndex={-1}>The Deck</h1></div>
      <header className="chairs-strip">
        <span><strong>You</strong> · only you swipe</span>
        <span><strong>ChatGPT</strong> · {agentConnected ? "can deal" : "not here"}</span>
        <span><strong>Dealer</strong> · {workspace.deck.consentEmbedded ? "embedded on" : "fixture"}</span>
        <span><strong>Reader</strong> · watches receipts</span>
        <span><strong>Skeptic</strong> · joins a later round</span>
      </header>

      <div className="deck-consent">
        <label><input type="checkbox" checked={workspace.deck.consentEmbedded} onChange={(event) => void updateDeckSettings({ consentEmbedded: event.target.checked })} /> Let the table&apos;s own dealer see my swipes <small>(never my notes)</small></label>
        <label><input type="checkbox" checked={workspace.deck.dwellTracking} onChange={(event) => void updateDeckSettings({ dwellTracking: event.target.checked })} /> Notice hesitation</label>
      </div>

      <section className="reader-guide" aria-labelledby="reader-guide-title">
        <div className="reader-guide__copy"><p className="reader-guide__eyebrow">Reader recommendation <span>{workspace.deck.consentEmbedded ? "AI-assisted deck" : "Private local guide"}</span></p><h2 id="reader-guide-title">{recommendation.title}</h2><p>{recommendation.detail}</p><small>Guidance shapes the process, never your answer. Embedded AI sees swipe receipts only when you switch it on.</small></div>
        <div className="reader-guide__signal"><div className="reader-guide__meter"><span>Reader signal</span><strong>{Math.min(workspace.swipes.length, 12)} / 12</strong><div role="progressbar" aria-label="Reader signal" aria-valuemin={0} aria-valuemax={12} aria-valuenow={Math.min(workspace.swipes.length, 12)}><i style={{ width: `${Math.min(100, workspace.swipes.length / 12 * 100)}%` }} /></div></div><p><span>{reasonCount} reasons</span><span>{slowCount} slow</span></p>{current ? <button type="button" onClick={() => setFlippedCardRef((value) => value === current.ref ? null : current.ref)}>{flipped ? "Return to the moment" : "Show the why choices"}</button> : null}</div>
      </section>

      {workspace.dealerNotes.some((note) => note.status === "visible") ? <section className="dealer-notes" aria-label="Dealer notes">{workspace.dealerNotes.filter((note) => note.status === "visible").map((note) => <article key={note.ref}><div><p>{note.postedBy.label}</p><blockquote>{note.text}</blockquote></div><button type="button" aria-label={`Dismiss note from ${note.postedBy.label}`} onClick={() => void dismissDealerNote(note.ref)}>Dismiss</button></article>)}</section> : null}

      <div className="table-grid">
        <aside className="pile-bank pile-bank--left">{PILES.slice(0, 3).map((pile) => <Pile key={pile.gesture} {...pile} count={counts[pile.gesture]} />)}</aside>
        <div className="card-stage">
          <p className="deck-kicker">{workspace.swipes.length < 12 ? `Card ${Math.min(16, workspace.swipes.length + 1)} of 16` : resolvedTensions.length < 2 ? "Reading the pattern" : latestRejectedPortrait && !hasSwipeAfterPortraitDeferral ? "Keep sorting · one more honest card" : portrait ? "Review your Portrait" : "Portrait forming"}</p>
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
          ) : <div className="empty-table">{busy ? "Dealing the next moments…" : workspace.swipes.length >= 16 ? "The Reader is looking across your piles." : "The tray is clear."}</div>}
          <div className="gesture-cross" aria-label="Swipe directions"><span>← not me</span><span>↑ I wish</span><span>↓ I used to</span><span>that&apos;s me →</span></div>
        </div>
        <aside className="pile-bank pile-bank--mobile" aria-label="Your four piles">{PILES.map((pile) => <Pile key={pile.gesture} {...pile} count={counts[pile.gesture]} />)}</aside>
        <aside className="tension-rail">
          <Pile {...PILES[3]} count={counts.me} />
          <h2>Tensions</h2>
          {workspace.tensions.filter((tension) => tension.status !== "rejected" && tension.status !== "superseded").map((tension) => <article key={tension.ref} className={`tension-card tension-card--${tension.status}`}><p>{tension.claim}</p><small>{tension.evidenceSwipeRefs.length} swipes · {tension.status}</small></article>)}
          {!workspace.tensions.length ? <p className="rail-empty">After twelve honest swipes, the Reader names a pull—not a type.</p> : null}
        </aside>
      </div>

      {openTension ? <DeckDialog className="decision-sheet" labelledBy="tension-dialog-title"><p id="tension-dialog-title" className="sheet-eyebrow">Reader · a tension, not a label</p>{editing === openTension.ref ? <><label className="field-label" htmlFor="tension-edit">Rewrite this tension in your words</label><textarea id="tension-edit" value={editText} onChange={(event) => setEditText(event.target.value)} /></> : <h2>{openTension.claim}</h2>}<p>{openTension.evidenceSwipeRefs.length} swipe receipts behind this.</p><div className="sheet-actions">{editing ? <button onClick={() => void resolveTension("edit")}>Save rewritten tension</button> : <><button onClick={() => void resolveTension("accept")}>Keep this tension</button><button onClick={() => { setEditing(openTension.ref); setEditText(openTension.claim); }}>Rewrite</button><button onClick={() => void resolveTension("reject")}>Set tension aside</button></>}</div></DeckDialog> : null}
      {portrait ? <DeckDialog className="portrait-screen" labelledBy="portrait-dialog-title"><p className="sheet-eyebrow">Your Portrait</p><h2 id="portrait-dialog-title">Not a type. The tensions you chose to keep.</h2>{portrait.tensionRefs.map((ref) => <blockquote key={ref}>{workspace.tensions.find((tension) => tension.ref === ref)?.claim}</blockquote>)}<button onClick={() => void resolvePortrait("accept")}>Keep this Portrait</button><button className="link-button" onClick={() => void resolvePortrait("reject")}>Keep sorting first</button></DeckDialog> : null}
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
  if (hasPortrait) return { title: "Keep only what helps you decide.", detail: "This Portrait is a working lens, not an identity. Keep it only if both tensions feel useful together." };
  if (hasOpenTension) return { title: "Treat the Reader's tension as a draft.", detail: "Keep it, rewrite it in your language, or set it aside. The Reader never gets the final word." };
  if (swipes >= 12) return { title: "You have enough signal for a Reader pass.", detail: "Keep sorting naturally while the Reader checks for a slow moment or a real contradiction." };
  if (swipes >= 6) return { title: "Pressure-test your biggest pile.", detail: "Do not chase balance. Notice whether the next moment belongs there on instinct or needs a reason." };
  if (swipes > 0) return { title: reasons === 0 ? "Add one piece of evidence." : "Mix instinct with evidence.", detail: flipped ? "Choose the reason that actually caught you, or skip all three without penalty." : "Turn over one card when you want the Reader to know what caught you. Fast swipes still count." };
  return { title: "Trust the first reaction.", detail: slow > 0 ? "The Reader noticed a pause, but the pile is still yours to choose." : "Swipe on instinct. Turn a card over only when you want to name why it caught you." };
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
