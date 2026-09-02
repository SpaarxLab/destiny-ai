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

const REACTION_COPY: Record<Gesture, { label: string; detail: string }> = {
  me: { label: "That's me", detail: "This already feels true of me." },
  not_me: { label: "Not me", detail: "This does not feel like me." },
  wish: { label: "I wish", detail: "I want more of this." },
  used_to: { label: "I used to", detail: "This fit an earlier version of me." },
};

const HYPOTHESIS_STATUS_COPY: Record<string, string> = {
  proposed: "Waiting for your review",
  accepted: "Agreed by you",
  edited: "Rewritten by you",
  survived: "Held up after the counterexample",
  falsified: "Weakened by the counterexample",
};

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
  const [pendingGesture, setPendingGesture] = useState<{ cardRef: string; gesture: Gesture } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [limitHours, setLimitHours] = useState(Math.max(1, workspace.participant.costCaps.hoursPerWeek || 3));
  const [limitMoney, setLimitMoney] = useState(workspace.participant.costCaps.money);
  const reactionGroup = useRef<HTMLDivElement>(null);
  const focusNextCard = useRef(false);
  const shownAt = useRef(0);
  const orchestration = useRef(new Set<string>());
  const unresolved = workspace.cards.filter((card) => card.status === "dealt");
  const current = unresolved[0] ?? null;
  const selectedGesture = current !== null && pendingGesture?.cardRef === current.ref ? pendingGesture.gesture : null;
  const flipped = selectedGesture !== null;
  const openTension = workspace.tensions.find((tension) => tension.status === "proposed") ?? null;
  const resolvedTensions = workspace.tensions.filter((tension) => ["accepted", "edited", "survived"].includes(tension.status));
  const portrait = workspace.portraits.find((candidate) => candidate.status === "proposed") ?? null;
  const latestRejectedPortrait = [...workspace.portraits].reverse().find((candidate) => candidate.status === "rejected") ?? null;
  const hasSwipeAfterPortraitDeferral = !latestRejectedPortrait || workspace.swipes.some((swipe) => swipe.at > latestRejectedPortrait.createdAt);
  const counts = useMemo(() => Object.fromEntries(PILES.map((pile) => [pile.gesture, workspace.swipes.filter((swipe) => swipe.gesture === pile.gesture).length])) as Record<Gesture, number>, [workspace.swipes]);

  useEffect(() => {
    shownAt.current = monotonicNow();
    if (focusNextCard.current) {
      focusNextCard.current = false;
      queueMicrotask(() => reactionGroup.current?.querySelector<HTMLButtonElement>(".reaction-choice")?.focus({ preventScroll: true }));
    }
  }, [current?.ref]);

  useEffect(() => {
    if (selectedGesture) queueMicrotask(() => document.querySelector<HTMLButtonElement>(".reason-choice")?.focus({ preventScroll: true }));
  }, [selectedGesture]);

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

  async function commitSwipe(gesture: Gesture, tappedReasonIndex?: 0 | 1 | 2) {
    if (!current || busy) return;
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

  function chooseReaction(gesture: Gesture) {
    if (!current || busy) return;
    setPendingGesture({ cardRef: current.ref, gesture });
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
      <div className="deck-intro"><p>A live experiment with ChatGPT</p><h1 tabIndex={-1}>ChatGPT A/B Tests Your Future</h1></div>
      <header className="chairs-strip">
        <span><strong>{agentConnected ? "ChatGPT connected" : "Open from ChatGPT"}</strong></span>
        <span>Your reactions stay yours</span>
      </header>

      {workspace.dealerNotes.some((note) => note.status === "visible") ? <section className="dealer-notes" aria-label="Dealer notes">{workspace.dealerNotes.filter((note) => note.status === "visible").map((note) => <article key={note.ref}><div><p>{note.postedBy.label}</p><blockquote>{note.text}</blockquote></div><button type="button" aria-label={`Dismiss note from ${note.postedBy.label}`} onClick={() => void dismissDealerNote(note.ref)}>Dismiss</button></article>)}</section> : null}

      <main className="table-grid">
        <div className="card-stage">
          <p className="deck-kicker">{current ? `Probe ${Math.min(5, workspace.swipes.length + 1)} of 5 max · ${current.probe?.template.replaceAll("_", " ") ?? current.kind}` : agentConnected ? "Waiting for ChatGPT" : "Continue from ChatGPT"}</p>
          {current ? <>
            <article className={`moment-card axis-${current.axis}`} aria-labelledby={`card-${current.ref}`}>
              <span className="card-agent">{current.dealtBy.label}</span>
              <h2 id={`card-${current.ref}`}>{current.text}</h2>
              {current.probe ? <details><summary>What is ChatGPT testing?</summary><p>{current.probe.uncertainty}</p><p><strong>One change:</strong> {current.probe.changedVariable}</p></details> : null}
            </article>

            <fieldset className="reaction-panel" disabled={busy}>
              <legend>How does this feel?</legend>
              <div ref={reactionGroup} className="reaction-grid">
                {PILES.map(({ gesture, hint }) => <button key={gesture} type="button" className={`reaction-choice reaction-choice--${gesture}`} aria-pressed={selectedGesture === gesture} onClick={() => chooseReaction(gesture)}><span aria-hidden="true">{hint}</span><strong>{REACTION_COPY[gesture].label}</strong><small>{REACTION_COPY[gesture].detail}</small></button>)}
              </div>
            </fieldset>

            {selectedGesture ? <section className="reason-panel" aria-labelledby="reason-title">
              <div className="reason-panel__selection"><span>Your reaction</span><strong>{REACTION_COPY[selectedGesture].label}</strong><button type="button" onClick={() => setPendingGesture(null)}>Change</button></div>
              <h3 id="reason-title">What made you choose that?</h3>
              <div className="reason-grid">{current.reasons?.map((reason, index) => <button className="reason-choice" type="button" key={reason} disabled={busy} onClick={() => void commitSwipe(selectedGesture, index as 0 | 1 | 2)}>{reason}</button>)}</div>
              <button className="reason-none" type="button" disabled={busy} onClick={() => void commitSwipe(selectedGesture)}>Skip the reason</button>
              <p>Choosing a reason will keep your <strong>{REACTION_COPY[selectedGesture].label}</strong> reaction.</p>
            </section> : <p className="reaction-hint">Choose one reaction. Nothing is saved until you add or skip a reason.</p>}
          </> : <div className="empty-table">{busy ? "ChatGPT is staging the next situation…" : agentConnected ? `Tell ChatGPT to ${workspace.swipes.length ? "continue" : "start the test"}.` : "Open this page from ChatGPT, then say “A/B test my future.”"}</div>}
        </div>

        <aside className="evidence-rail" aria-label="Your recorded reactions">
          <div className="evidence-rail__head"><h2>Your evidence</h2><span>{workspace.swipes.length} saved</span></div>
          <div className="reaction-totals">{PILES.map((pile) => <Pile key={pile.gesture} {...pile} count={counts[pile.gesture]} />)}</div>
          <label className="dwell-setting"><input type="checkbox" checked={workspace.deck.dwellTracking} onChange={(event) => void updateDeckSettings({ dwellTracking: event.target.checked })} /> Count response time as evidence</label>
          {workspace.tensions.filter((tension) => tension.status !== "rejected" && tension.status !== "superseded").map((tension) => <article key={tension.ref} className={`tension-card tension-card--${tension.status}`}><span>Working idea</span><p>{tension.claim}</p><small>{tension.evidenceSwipeRefs.length} supporting reactions · {HYPOTHESIS_STATUS_COPY[tension.status] ?? "Updated"}</small></article>)}
        </aside>
      </main>

      {!current && !openTension && resolvedTensions.length > 0 ? <section className="experiment-limits" aria-labelledby="limits-title"><div><p>Only needed for the final seven-day test</p><h2 id="limits-title">What is genuinely easy to try this week?</h2></div><div className="probe-limits" role="group" aria-label="Seven-day experiment limits"><label>Time <span><input type="number" min="0.5" max="168" step="0.5" value={limitHours} onChange={(event) => setLimitHours(Number(event.target.value))} /> hours</span></label><label>Spend <span>$ <input type="number" min="0" step="1" value={limitMoney} onChange={(event) => setLimitMoney(Number(event.target.value))} /></span></label><button type="button" onClick={() => void saveLimits()}>Save test limits</button></div></section> : null}

      {openTension ? <DeckDialog className="decision-sheet" labelledBy="tension-dialog-title"><p id="tension-dialog-title" className="sheet-eyebrow">ChatGPT · {openTension.interpretation === "initial" ? "falsifiable hypothesis" : `${openTension.interpretation} its interpretation`}</p>{editing === openTension.ref ? <><label className="field-label" htmlFor="tension-edit">Rewrite this hypothesis in your words</label><textarea id="tension-edit" value={editText} onChange={(event) => setEditText(event.target.value)} /></> : <h2>{openTension.claim}</h2>}<p>{openTension.evidenceSwipeRefs.length} supporting swipe receipts · {openTension.contradictorySwipeRefs.length} contradictory receipts.</p>{openTension.supersedesTensionRef ? <p><strong>What changed:</strong> ChatGPT {openTension.interpretation} its earlier hypothesis after the counterexample.</p> : null}<div className="sheet-actions">{editing ? <button onClick={() => void resolveTension("edit")}>Save rewritten hypothesis</button> : <><button onClick={() => void resolveTension("accept")}>Keep as a working hypothesis</button><button onClick={() => { setEditing(openTension.ref); setEditText(openTension.claim); }}>Rewrite</button><button onClick={() => void resolveTension("reject")}>Reject hypothesis</button></>}</div></DeckDialog> : null}
      <p className="deck-status" role="status">{message}</p>
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
