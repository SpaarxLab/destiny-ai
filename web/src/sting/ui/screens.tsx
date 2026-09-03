"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LINES } from "../content";
import { lifeByRef, openProbe, type Hypothesis, type Player, type Probe, type Reaction, type Workspace, openQuestion } from "../domain";
import { commitment } from "../hash";
import { humanLine, playerName, type Move } from "../kernel";
import { AgentView } from "./agent-view";
import { QuestionCard, RulesOfMe, VoiceLine } from "./asks";
import { Poster, Proof, Seal, Thinking, useLongPress } from "./primitives";

type Act = (move: Move) => Promise<boolean>;

interface ScreenProps {
  ws: Workspace;
  act: Act;
  player: Player;
  playerLabel: string;
  thinking: string | null;
  /** True when the player has nothing left to say on this screen and the person must act. */
  ready: boolean;
}

/* ---------- Door ---------- */

export function DoorScreen({ act, playerLabel, enabled, connected }: { act: Act; playerLabel: string; enabled: boolean; connected?: boolean }) {
  const [timing, setTiming] = useState(true);
  return (
    <div className="sting-enter" style={{ display: "flex", flexDirection: "column", gap: 28, justifyContent: "center", flex: 1, maxWidth: 640 }}>
      <div>
        <h1 className="sting-display">
          {connected ? "Your AI says it knows you." : `${enabled ? playerLabel : "An AI"} thinks it knows what you want.`}
        </h1>
        <p className="sting-display sting-warm" style={{ marginTop: 8 }}>{connected ? "Make it bet." : "Prove it wrong."}</p>
      </div>
      {connected ? (
        <div className="door-agent">
          <span className="sting-eyebrow" style={{ color: "var(--cold)" }}>an agent can use this page</span>
          <p className="sting-body" style={{ margin: 0 }}>
            Tap Play, then tell your agent: <code>play STING with me</code>. It casts eight lives from what it already knows about you, then bets chips before each two-life choice. Right, it earns the right to describe you. Wrong, it loses chips and has to say what it misread. Only you can tap.
          </p>
        </div>
      ) : (
        <p className="sting-body sting-muted" style={{ maxWidth: 480 }}>
          It shows you eight lives. You tap the ones you’d want. Then it stakes chips before each two-life choice and pays when it misreads you. Leave with what you actually want, what you’re good at, and one small thing to try this week.
        </p>
      )}
      <div className="sting-actions">
        <button className="sting-btn sting-btn--warm" onClick={() => act({ type: "start", timing })}>
          {LINES.door.play}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="sting-small">{LINES.door.meta}</span>
        <label className="sting-toggle">
          <input type="checkbox" checked={timing} onChange={(event) => setTiming(event.target.checked)} />
          measure hesitation (shared only as fast / medium / slow with this match&apos;s player; raw timing stays here)
        </label>
        <span className="sting-small">
          {connected
            ? "WebMCP is on in this browser. The page waits for your agent; if none shows up you can play a model or the house instead."
            : enabled
              ? `Playing against ${playerLabel}, a model reached through OpenCode Go. The house takes over if it stalls.`
              : "No model is connected. The house plays, with the same rules."}
        </span>
      </div>
    </div>
  );
}

/* ---------- Cast ---------- */

export function CastScreen({ ws, act, player, playerLabel, thinking }: ScreenProps) {
  const shownAt = useRef<number>(0);
  useEffect(() => {
    shownAt.current = performance.now();
  }, [ws.lives.length]);
  const step = ws.picks.stings.length < 2 ? ws.picks.stings.length : 2;
  const waiting = ws.lives.length === 0;
  return (
    <div className="sting-enter" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <span className="sting-eyebrow" style={{ color: player === "house" ? "var(--house)" : "var(--cold)" }}>{waiting ? thinking ?? `${playerLabel} is casting` : LINES.castTitle(playerLabel)}</span>
        <h2 className="sting-title" style={{ marginTop: 8 }}>{waiting ? "Eight lives are on their way." : LINES.prompts[step]}</h2>
        <VoiceLine ws={ws} at={ws.probes.find((probe) => probe.kind === "cast")?.stagedAt ?? -1} />
      </div>
      {waiting ? (
        <div className="sting-grid" aria-busy="true">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="poster skeleton" />)}
        </div>
      ) : (
        <div className="sting-grid">
          {ws.lives.map((life) => {
            const isSting = ws.picks.stings.includes(life.ref);
            const isSecret = ws.picks.secret === life.ref;
            const state = isSting ? "sting" : isSecret ? "secret" : undefined;
            return (
              <Poster
                key={life.ref}
                line={life.line}
                scene={life.scene}
                tone={isSting ? "warm" : isSecret ? "warm" : player === "house" ? "neutral" : "cold"}
                state={state}
                tag={isSting ? "stings" : isSecret ? "secret" : undefined}
                onPick={() => {
                  if (isSting || isSecret) {
                    void act({ type: "unpick_life", lifeRef: life.ref });
                    return;
                  }
                  const dwell = performance.now() - shownAt.current;
                  shownAt.current = performance.now();
                  void act({ type: "pick_life", lifeRef: life.ref, dwellMs: dwell });
                }}
              />
            );
          })}
        </div>
      )}
      {step === 2 && !waiting ? (
        <div className="sting-actions">
          <button className="sting-btn sting-btn--quiet" onClick={() => act({ type: "skip_secret" })}>{LINES.tooClose}</button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Duel ---------- */

export function DuelScreen({ ws, act, player, playerLabel, thinking }: ScreenProps) {
  const probe = openProbe(ws);
  const shownAt = useRef<number>(0);
  useEffect(() => {
    shownAt.current = performance.now();
  }, [probe?.ref]);
  const last = ws.reactions.at(-1);
  const lastProbe = last ? ws.probes.find((item) => item.ref === last.probeRef) : undefined;
  const correction = last ? ws.hypotheses.find((item) => item.kind === "revision" && item.revises === last.ref) : undefined;
  const count = ws.reactions.length;

  if (!probe) {
    const question = openQuestion(ws);
    return (
      <div className="sting-enter" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {last && lastProbe && !question ? <Reveal ws={ws} reaction={last} probeRef={lastProbe.ref} playerLabel={playerLabel} correction={correction} /> : null}
        {question ? <QuestionCard ws={ws} act={act} /> : <Thinking player={player} label={thinking ?? `${playerLabel} is thinking`} />}
      </div>
    );
  }

  return (
    <div className="sting-enter" key={probe.ref} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
        <Seal player={probe.player} chips={probe.bet?.chips ?? undefined} commitment={probe.commitment} />
        <VoiceLine ws={ws} at={probe.stagedAt} />
        <h2 className="sting-title">{LINES.stillStings}</h2>
        <span className="sting-small">Duel {count + 1} · one thing changed: {probe.variable}</span>
      </div>
      <div className="duel">
        {probe.lives.map((life, index) => (
          <Poster
            key={life.ref}
            line={life.line}
            scene={life.scene}
            tone="neutral"
            ariaLabel={`${index === 0 ? "Left" : "Right"}: ${life.line}`}
            onPick={() => {
              const dwell = performance.now() - shownAt.current;
              void act({ type: "react", probeRef: probe.ref, pick: index === 0 ? "a" : "b", dwellMs: dwell });
            }}
          />
        ))}
      </div>
      <span className="sting-small">Keys 1 and 2 also work.</span>
    </div>
  );
}

function Reveal({ ws, reaction, probeRef, playerLabel, correction }: { ws: Workspace; reaction: Reaction; probeRef: string; playerLabel: string; correction?: Hypothesis }) {
  const probe = ws.probes.find((item) => item.ref === probeRef)!;
  const bet = probe.bet!;
  const hit = reaction.betOutcome === "hit";
  const betLife = probe.lives[bet.pick === "a" ? 0 : 1];
  const pickedLife = probe.lives[reaction.pick === "a" ? 0 : 1];
  const name = playerName(probe.player);
  return (
    <div className="reveal" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="reveal__row">
        <span className={`reveal__mark ${hit ? "reveal__mark--hit" : "reveal__mark--miss"}`}>{hit ? "✓" : "✗"}</span>
        <span>
          <b>{name}</b> bet <b>“{betLife.line}”</b> for {bet.chips}. You picked <b>“{pickedLife.line}”</b>.
        </span>
      </div>
      <p className="reveal__quote">{hit ? bet.because : correction?.correction ?? bet.because}</p>
      <span className="sting-small">{hit ? `${name} was right. +${bet.chips} chips.` : `${name} was wrong. −${bet.chips} chips.`} · sealed {probe.commitment}</span>
      <SealVerify probe={probe} />
      <div className="duel">
        <Poster line={probe.lives[0].line} scene={probe.lives[0].scene} tone={reaction.pick === "a" ? "warm" : "neutral"} state={reaction.pick === "a" ? "sting" : "dim"} tag={bet.pick === "a" ? `${playerLabel === name ? playerLabel : name} bet` : undefined} />
        <Poster line={probe.lives[1].line} scene={probe.lives[1].scene} tone={reaction.pick === "b" ? "warm" : "neutral"} state={reaction.pick === "b" ? "sting" : "dim"} tag={bet.pick === "b" ? `${name} bet` : undefined} />
      </div>
    </div>
  );
}

function SealVerify({ probe }: { probe: Probe }) {
  const [state, setState] = useState<"idle" | "checking" | "match" | "mismatch">("idle");
  const [hash, setHash] = useState<string | null>(null);
  if (!probe.bet || !probe.commitment) return null;
  const bet = probe.bet;
  const sealed = probe.commitment;
  const verify = async () => {
    setState("checking");
    const recomputed = await commitment(bet, probe.operationId);
    setHash(recomputed);
    setState(recomputed === sealed ? "match" : "mismatch");
  };
  return (
    <div className="seal-verify">
      <button type="button" className="sting-btn sting-btn--quiet" onClick={() => void verify()} disabled={state === "checking"}>
        {state === "checking" ? "checking…" : "verify seal"}
      </button>
      {state === "match" ? <span className="seal-verify__result seal-verify__result--match">matches ✓ {hash}</span> : null}
      {state === "mismatch" ? <span className="seal-verify__result seal-verify__result--mismatch">MISMATCH</span> : null}
      {state === "match" || state === "mismatch" ? (
        <p className="sting-small">The bet was hashed before you tapped. We just re-ran the hash in your browser.</p>
      ) : null}
    </div>
  );
}

/* ---------- Verdict ---------- */

export function VerdictScreen({ ws, act, player, playerLabel, thinking, ready }: ScreenProps) {
  const [pendingKill, setPendingKill] = useState(false);
  const question = openQuestion(ws);
  if (question) {
    return (
      <div className="sting-enter" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
        <QuestionCard ws={ws} act={act} />
      </div>
    );
  }
  const lines = ws.hypotheses.filter((item) => ["hunger", "mask", "edge"].includes(item.kind) && item.status !== "killed");
  const cold = ws.hypotheses.find((item) => item.kind === "cold_read");
  const waiting = !ready || pendingKill;
  const misses = ws.reactions.filter((item) => item.betOutcome === "miss");
  const name = playerLabel;

  return (
    <div className="sting-enter" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
      <div>
        <span className="sting-eyebrow" style={{ color: player === "house" ? "var(--house)" : "var(--cold)" }}>
          {ws.record.earned ? LINES.earned(name) : ws.record.bust ? LINES.bust(name) : `${name} never earned a guess`} · {ws.record.hits} right · {ws.record.misses} wrong
        </span>
        <h2 className="sting-title" style={{ marginTop: 8 }}>{ws.record.earned ? "Keep what’s true. Cross out what isn’t." : LINES.noAi}</h2>
        {!ws.record.earned ? (
          <p className="sting-body sting-muted" style={{ marginTop: 10 }}>
            It still has to guess. These are unearned drafts. Cross out what’s wrong, keep what lands.
          </p>
        ) : null}
      </div>
      {!ws.record.earned && misses.length ? (
        <ul className="fight__taps">
          {misses.map((reaction) => {
            const life = lifeByRef(ws, reaction.pickedLifeRef);
            const probe = ws.probes.find((item) => item.ref === reaction.probeRef);
            return <li key={reaction.ref}>It bet “{probe?.lives[probe.bet?.pick === "a" ? 0 : 1].line}”. You picked “{life?.line}”.</li>;
          })}
        </ul>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {lines.map((line) => <VerdictLine key={line.ref} ws={ws} line={line} act={act} onKilling={setPendingKill} />)}
      </div>
      {ws.voice.at(-1) && (ws.voice.at(-1)!.at > (ws.reactions.at(-1)?.at ?? 0)) ? <VoiceLine ws={ws} at={ws.voice.at(-1)!.at} /> : null}
      {waiting ? <Thinking player={player} label={thinking ?? `${name} is deciding`} /> : null}
      {cold?.text ? <p className="sting-small">Its cold guess, sealed before the first duel, was “{cold.text}”.</p> : null}
      <RulesOfMe ws={ws} act={act} />
      <AgentView ws={ws} />
      {!waiting ? (
        <div className="sting-actions">
          <button className="sting-btn" onClick={() => act({ type: "keep_all" })}>{lines.length > 0 ? "Keep what’s left" : "Continue"}</button>
        </div>
      ) : null}
    </div>
  );
}

function VerdictLine({ ws, line, act, onKilling }: { ws: Workspace; line: Hypothesis; act: Act; onKilling: (pending: boolean) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [dying, setDying] = useState(false);
  const { pressing, handlers } = useLongPress(() => setConfirming(true));
  const proofLines = useMemo(() => humanLine(ws, line), [ws, line]);
  const kill = async () => {
    setDying(true);
    onKilling(true);
    try {
      const killed = await act({ type: "kill", hypothesisRef: line.ref });
      if (!killed) setDying(false);
    } finally {
      onKilling(false);
    }
  };
  const label = `${line.kind === "hunger" ? "what you want" : line.kind === "mask" ? "what you chase, and let go of" : "what you're good at"}${line.earned ? "" : " · unearned draft"}`;
  return (
    <div className={`line ${pressing ? "line--pressing" : ""} ${dying ? "line--killed" : ""}`} {...handlers}>
      <span className="sting-eyebrow sting-warm">{label}</span>
      <p className="line__text">{line.text}</p>
      <Proof lines={proofLines} details={`${line.ref} · v${line.at}`} />
      {confirming ? (
        <div className="sting-actions" style={{ marginTop: 4 }}>
          <button className="sting-btn sting-btn--warm" style={{ minHeight: 44 }} onClick={kill}>Not me</button>
          <button className="sting-btn sting-btn--quiet" onClick={() => setConfirming(false)}>Keep</button>
        </div>
      ) : (
        <button className="line__kill" aria-label={`Not me: “${line.text}”`} onClick={() => setConfirming(true)}>✕</button>
      )}
    </div>
  );
}

/* ---------- Fight ---------- */

export function FightScreen({ ws, act, player, playerLabel, thinking }: ScreenProps) {
  const [burning, setBurning] = useState<string | null>(null);
  if (!ws.fight) {
    return (
      <div className="sting-enter" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <h2 className="sting-title">{LINES.fightTitle}</h2>
        <Thinking player={player} label={thinking ?? `${playerLabel} is setting the ring`} />
      </div>
    );
  }
  const sides = ws.fight.refs.map((ref) => ws.hypotheses.find((item) => item.ref === ref)!);
  return (
    <div className="sting-enter" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <span className="sting-eyebrow">Two things you want, each backed by your own choices</span>
        <h2 className="sting-title" style={{ marginTop: 8 }}>{LINES.fightTitle}</h2>
      </div>
      <div className="fight">
        {sides.map((side) => (
          <button
            key={side.ref}
            className={`fight__side ${burning && burning !== side.ref ? "poster--burn" : ""} ${burning === side.ref ? "line--crowned" : ""}`}
            disabled={Boolean(burning)}
            onClick={() => {
              setBurning(side.ref);
              window.setTimeout(() => void act({ type: "crown", hypothesisRef: side.ref }), 750);
            }}
          >
            <span className="sting-eyebrow sting-warm">you want</span>
            <span className="line__text">{side.text}</span>
            <ul className="fight__taps">{humanLine(ws, side).slice(0, 3).map((tap, index) => <li key={index}>{tap}</li>)}</ul>
            <span className="sting-small" style={{ marginTop: "auto" }}>tap the one that leads · the other steps back</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Lives ---------- */

export function LivesScreen({ ws, act, player, playerLabel, thinking }: ScreenProps) {
  const [open, setOpen] = useState<string | null>(null);
  if (ws.posters.length === 0) {
    return (
      <div className="sting-enter" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <h2 className="sting-title">{LINES.livesTitle}</h2>
        <Thinking player={player} label={thinking ?? `${playerLabel} is laying out three lives`} />
      </div>
    );
  }
  const chosen = ws.posters.find((poster) => poster.ref === open);
  return (
    <div className="sting-enter" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h2 className="sting-title">{LINES.livesTitle}</h2>
      <div className="sting-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {ws.posters.map((poster) => (
          <Poster key={poster.ref} line={poster.line} scene={poster.scene} tone={open === poster.ref ? "warm" : "cold"} state={open === poster.ref ? "sting" : undefined} onPick={() => setOpen(poster.ref)} />
        ))}
      </div>
      {chosen ? (
        <div className="dare sting-enter" key={chosen.ref}>
          <span className="sting-eyebrow">a week in this life</span>
          <ul className="fight__taps">{chosen.week.map((day, index) => <li key={index}>{day}</li>)}</ul>
          <p className="sting-body"><span className="sting-muted">The cost.</span> {chosen.tradeoff}</p>
          <p className="sting-body"><span className="sting-muted">What testing it would teach.</span> {chosen.question}</p>
          <div className="sting-actions">
            <button className="sting-btn sting-btn--warm" onClick={() => act({ type: "choose_poster", posterRef: chosen.ref })}>Test this life</button>
          </div>
        </div>
      ) : (
        <span className="sting-small">Tap a life to see its week.</span>
      )}
    </div>
  );
}

/* ---------- Dare ---------- */

export function DareScreen({ ws, act, player, playerLabel, thinking }: ScreenProps) {
  const dare = ws.dare;
  if (!dare) {
    return (
      <div className="sting-enter" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <h2 className="sting-title">{LINES.dareTitle(playerLabel)}</h2>
        <Thinking player={player} label={thinking ?? `${playerLabel} is looking for a dare`} />
      </div>
    );
  }
  return <DareForm key={dare.ref} ws={ws} act={act} player={player} />;
}

function DareForm({ ws, act, player }: { ws: Workspace; act: Act; player: Player }) {
  const dare = ws.dare!;
  const [hours, setHours] = useState<string>(String(dare.hours));
  const [money, setMoney] = useState<string>(String(dare.money));
  const [currency, setCurrency] = useState<"INR" | "USD" | "EUR" | "GBP" | "AED">(dare.currency);
  return (
    <div className="sting-enter" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
      <div>
        <span className="sting-eyebrow" style={{ color: player === "house" ? "var(--house)" : "var(--cold)" }}>{LINES.dareTitle(playerName(player))}</span>
        <h2 className="sting-title" style={{ marginTop: 8 }}>{dare.action}</h2>
      </div>
      <div className="dare">
        <p className="sting-body"><span className="sting-muted">Done looks like.</span> {dare.doneLooksLike}</p>
        <p className="sting-body"><span className="sting-muted">Inside.</span> {dare.days} days · about {dare.hours}h · {dare.money} {dare.currency}</p>
        {dare.source ? (
          <details className="proof">
            <summary>where it found this</summary>
            <p className="sting-small" style={{ marginTop: 8 }}>{dare.source.excerpt}</p>
            <p className="sting-small">{dare.source.url}</p>
          </details>
        ) : null}
        <hr className="sting-hr" />
        <span className="sting-eyebrow">your limits this week (its estimate is only a starting point; change anything)</span>
        <form
          className="limits"
          onSubmit={(event) => {
            event.preventDefault();
            void act({ type: "accept_dare", hours: Number(hours) || 0, money: Number(money) || 0, currency });
          }}
        >
          <label>
            hours
            <input inputMode="decimal" type="number" min="0" max="6" step="0.5" value={hours} onChange={(event) => setHours(event.target.value)} />
          </label>
          <label>
            money
            <input inputMode="numeric" type="number" min="0" max="2000" step="1" value={money} onChange={(event) => setMoney(event.target.value)} />
          </label>
          <label>
            currency
            <select value={currency} onChange={(event) => setCurrency(event.target.value as typeof currency)}>
              {["INR", "USD", "EUR", "GBP", "AED"].map((code) => <option key={code}>{code}</option>)}
            </select>
          </label>
          <div className="sting-actions" style={{ gridColumn: "1 / -1", marginTop: 6 }}>
            <button type="submit" className="sting-btn sting-btn--warm">{LINES.takeDare}</button>
            <button type="button" className="sting-btn sting-btn--quiet" onClick={() => void act({ type: "reject_dare" })}>Not this dare</button>
          </div>
        </form>
      </div>
    </div>
  );
}
