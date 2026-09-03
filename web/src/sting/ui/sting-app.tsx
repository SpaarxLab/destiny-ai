"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LINES } from "../content";
import { openProbe, type Player, type Workspace } from "../domain";
import { houseMove } from "../driver";
import { StingKernel, playerName, type Command, type Move, type PendingMove } from "../kernel";
import { allowedTurnMoves, askSpark, buildContext, commandFromOutput, fetchPlayerStatus, isPersonsTurn, requiredMove, type PlayerStatus } from "../player";
import type { MoveKind } from "../spark/schemas";
import { LocalStore } from "../store";
import { StingWebMcp, canExternalAgentMove, toolsForRoom } from "../webmcp";
import { waitForModelContext } from "../../webmcp/runtime";
import { AuthorityStrip } from "./authority";
import { CardScreen } from "./card";
import { Preflight } from "./preflight";
import { Chips, Toast } from "./primitives";
import { CastScreen, DareScreen, DoorScreen, DuelScreen, FightScreen, LivesScreen, VerdictScreen } from "./screens";

const REVEAL_HOLD_MS = 2300;
const HOUSE_FEEL_MS = 350;
const HOUSE_OFFER_MS = 20_000;

const VERBS: Record<MoveKind, string> = {
  cast: "casting eight lives",
  cold_read: "sealing a guess",
  duel: "dealing a duel",
  correction: "admitting it",
  verdict: "deciding what you want",
  lives: "laying out three lives",
  dare: "looking for a dare",
  brief: "writing your brief",
  question: "spending a chip to ask you something",
  letter: "sealing a letter about your week",
  turn: "choosing its move",
};

/**
 * A demo clock: `?clock=+7d` moves the room's clock forward so a judge can open a sealed letter without waiting a week.
 * It is shown on screen whenever it is on; the receipts record the shifted time honestly.
 */
function clockOffsetMs(): number {
  if (typeof window === "undefined") return 0;
  const raw = new URLSearchParams(window.location.search).get("clock");
  const match = raw?.trim().match(/^([+-]?\d+)([dhm])$/);
  if (!match) return 0;
  const unit = { d: 86_400_000, h: 3_600_000, m: 60_000 }[match[2] as "d" | "h" | "m"];
  return Number(match[1]) * unit;
}

function uuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function StingApp() {
  const kernel = useRef<StingKernel | null>(null);
  const [ws, setWs] = useState<Workspace | null>(null);
  const [status, setStatus] = useState<PlayerStatus>({ enabled: false, model: "", label: "The house" });
  const [thinking, setThinking] = useState<{ player: Player; label: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!thinking) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => {
      window.clearInterval(timer);
      setElapsed(0);
    };
  }, [thinking]);
  const [toast, setToast] = useState<{ text: string; tone: "cold" | "warm" | "house" | "room" } | null>(null);
  const [houseOffer, setHouseOffer] = useState(false);
  const [broken, setBroken] = useState<string | null>(null);
  const [turn, setTurn] = useState(0);
  const busy = useRef(false);
  const holdUntil = useRef(0);
  const bridge = useRef<StingWebMcp | null>(null);
  const takeover = useRef(false);
  const handoffPending = useRef(false);
  const sparkVerdictDone = useRef<number | null>(null);
  /** State version at which every player gave up on a move; the person then gets the controls back. */
  const [gaveUp, setGaveUp] = useState<number | null>(null);
  const houseFailures = useRef<{ version: number; count: number }>({ version: -1, count: 0 });
  const [connected, setConnected] = useState(false);
  const [agentSeen, setAgentSeen] = useState(false);
  /** With an agent present the page waits for it; the person may instead choose a model or the house to play. */
  const [fallback, setFallback] = useState<"spark" | "house" | null>(null);
  const abort = useRef<AbortController | null>(null);
  const toastTimer = useRef<number | null>(null);
  const clockOffset = useRef(0);
  const now = useCallback(() => new Date(Date.now() + clockOffset.current), []);

  useEffect(() => {
    // The kernel and the WebMCP bridge are created synchronously so a StrictMode double-mount stops the
    // first bridge before the second registers; React state is updated off the effect body.
    let cancelled = false;
    let link: StingWebMcp | null = null;
    try {
      clockOffset.current = clockOffsetMs();
      const k = new StingKernel(new LocalStore(window.localStorage), now);
      kernel.current = k;
      const initial = k.load();
      const created = new StingWebMcp({
        kernel: k,
        onChanged: (room) => {
          // Any successful agent move cancels the delayed house fallback. A
          // late agent response must never leave both players' controls live.
          setHouseOffer(false);
          // A WebMCP move can hand authority straight back to the person (for
          // example, a staged duel or a completed verdict). Clear the previous
          // agent-thinking state at that boundary or the human controls stay
          // hidden behind a stale "your agent's move" state.
          if (isPersonsTurn(room, now())) {
            setThinking(null);
          }
          setWs(room);
          setTurn((value) => value + 1);
        },
        operationId: uuid,
      });
      created.onAgentSeen = () => setAgentSeen(true);
      link = created;
      bridge.current = created;
      if (!created.connected) {
        // Hosts and extensions attach document.modelContext after first paint; keep looking for a while.
        void waitForModelContext(15_000).then((context) => {
          if (cancelled || !context || bridge.current !== created) return;
          void created.attach(context).then(() => setConnected(created.connected));
        });
      }
      queueMicrotask(() => {
        if (cancelled) return;
        setWs(initial);
        void created
          .sync(initial)
          .catch(() => undefined)
          .finally(() => {
            if (!cancelled) setConnected(created.connected);
          });
      });
    } catch (error) {
      queueMicrotask(() => setBroken(String(error)));
    }
    void fetchPlayerStatus().then((value) => {
      if (!cancelled) setStatus(value);
    });
    return () => {
      cancelled = true;
      link?.stop();
      if (bridge.current === link) bridge.current = null;
    };
  }, [now]);

  // Keep the WebMCP catalogue shaped like the room: phase, kills, open decisions.
  useEffect(() => {
    const link = bridge.current;
    if (!ws || !link) return;
    void link
      .sync(ws)
      .catch(() => undefined)
      .finally(() => {
        if (!link.connected) setConnected(false);
      });
  }, [ws]);

  const say = useCallback((text: string, tone: "cold" | "warm" | "house" | "room") => {
    setToast({ text, tone });
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const exec = useCallback(
    async (actor: "participant" | Player, move: Move | PendingMove): Promise<boolean> => {
      const k = kernel.current;
      if (!k) return false;
      const current = k.load();
      // A person's tap belongs to the room they can actually see. Reloading the
      // newest storage version here could silently reinterpret a stale tab's
      // tap as a different decision (for example, a third cast pick as secret).
      const expectedVersion = actor === "participant" ? (ws?.stateVersion ?? current.stateVersion) : current.stateVersion;
      const command = { ...move, expectedVersion, operationId: uuid() } as Command;
      const result = await k.execute(actor, command);
      if (!result.ok) {
        if (result.code === "STALE_VERSION") setWs(k.load());
        if (actor === "participant") say(result.message, "warm");
        else console.warn("[sting] denied", actor, move.type, result.code, result.message);
        return false;
      }
      setWs(result.workspace);
      const latest = result.workspace.activity.filter((item) => item.at === result.workspace.stateVersion && item.who !== "you").at(-1);
      if (latest && actor !== "participant" && move.type !== "stage_duel" && move.type !== "cast") say(latest.text, latest.who === "house" ? "house" : latest.who === "room" ? "room" : "cold");
      return true;
    },
    [say, ws?.stateVersion],
  );

  const act = useCallback(
    async (move: Move): Promise<boolean> => {
      const ok = await exec("participant", move);
      if (ok && move.type === "react") holdUntil.current = Date.now() + REVEAL_HOLD_MS;
      return ok;
    },
    [exec],
  );

  const handTo = useCallback(async (target: "spark" | "house") => {
    // Freeze the page driver before the first await, but keep the visiting
    // bridge alive until the yield receipt is safely persisted. If persistence
    // fails, roll the visible owner back instead of splitting UI/tool authority.
    const previousTakeover = takeover.current;
    const previousFallback = fallback;
    handoffPending.current = true;
    takeover.current = target === "house";
    setFallback(target);
    const k = kernel.current;
    if (!k) {
      handoffPending.current = false;
      takeover.current = previousTakeover;
      setFallback(previousFallback);
      return;
    }
    let recorded = false;
    try {
      for (let attempt = 0; attempt < 3 && !recorded; attempt += 1) {
        const current = k.load();
        const result = await k.execute("participant", { type: "yield_agent", target, expectedVersion: current.stateVersion, operationId: uuid() });
        if (result.ok) {
          setWs(result.workspace);
          recorded = true;
        } else if (result.code !== "STALE_VERSION") {
          say(result.message, "warm");
          break;
        }
      }
    } catch (error) {
      say(`The handoff was not saved: ${String(error).slice(0, 120)}`, "warm");
    }
    if (!recorded) {
      handoffPending.current = false;
      takeover.current = previousTakeover;
      setFallback(previousFallback);
      setWs(k.load());
      setTurn((value) => value + 1);
      return;
    }
    bridge.current?.suspend();
    setConnected(false);
    handoffPending.current = false;
    setHouseOffer(false);
    setTurn((value) => value + 1);
  }, [fallback, say]);

  const startOver = useCallback(async () => {
    if (!window.confirm(LINES.startOver)) return;
    abort.current?.abort();
    bridge.current?.stop();
    const store = new LocalStore(window.localStorage);
    await store.clear();
    // Reloading recreates the kernel and WebMCP bridge together, clears every
    // transient fallback/timer, and removes a demo-clock query from the new match.
    window.location.assign(window.location.pathname);
  }, []);

  // The player's turn: Spark through OpenCode Go first, the house if Spark is off, stalls, or is denied twice.
  // Driven by an explicit turn counter so a finished turn always schedules the next check.
  useEffect(() => {
    const k = kernel.current;
    if (!ws || !k || busy.current || handoffPending.current) return;
    if (ws.phase === "door" || isPersonsTurn(ws, now()) || gaveUp === ws.stateVersion) return;
    if (connected && !fallback && !takeover.current && canExternalAgentMove(ws, now())) {
      // An agent can reach this page. Its moves come through the tools; the page waits and shows what it does.
      // Structural moves and any move revoked by standing are completed by the room below.
      setThinking({ player: "chatgpt", label: agentSeen ? "your agent's move" : "waiting for your agent" });
      // A reload cannot know whether an external agent is still present. Give the
      // browser a real wait before inserting a competing "play instead" decision.
      // Otherwise the escape hatch becomes the visual next step whenever a tool
      // is actually allowed to continue the match.
      const timer = window.setTimeout(() => setHouseOffer(true), HOUSE_OFFER_MS);
      return () => window.clearTimeout(timer);
    }
    busy.current = true;

    const holdOut = async () => {
      const wait = holdUntil.current - Date.now();
      if (wait > 0) await sleep(wait);
    };
    const run = async () => {
      const room = k.load();
      const kind = requiredMove(room, now());
      if (!kind) return;
      const externalCanAct = connected && !fallback && !takeover.current && canExternalAgentMove(room, now());
      const wantSpark = status.enabled && (!connected || fallback === "spark");
      const matchPlayer: Player = takeover.current || fallback === "house" ? "house" : fallback === "spark" && status.enabled ? "spark" : room.record.player === "chatgpt" ? externalCanAct ? "chatgpt" : "house" : room.record.player === "spark" || (room.phase === "cast" && wantSpark) ? "spark" : "house";
      // During the duels Spark chooses whether to bet or ask; closing is a deterministic room transition.
      const captain = matchPlayer === "spark" && status.enabled && (kind === "duel" || kind === "question") && allowedTurnMoves(room).length > 0;

      if (kind === "fight" || kind === "brief" || (kind === "close" && !captain)) {
        await holdOut();
        const move = houseMove(k.load(), now());
        const structuralPlayer: Player = kind === "brief" ? "house" : matchPlayer;
        if (move) await exec(structuralPlayer, { ...move, player: structuralPlayer } as PendingMove);
        return;
      }
      if (kind !== "verdict") sparkVerdictDone.current = null;

      if (matchPlayer === "chatgpt") {
        // Only structural moves reach here for a connected agent; creative ones wait for its tools.
        return;
      }

      // Spark gives the whole verdict in one call; anything it left out, the house fills locally.
      const askSparkNow = matchPlayer === "spark" && status.enabled && !(kind === "verdict" && sparkVerdictDone.current === room.stateVersion);
      if (askSparkNow) {
        const sparkKind: MoveKind = captain ? "turn" : kind;
        setThinking({ player: "spark", label: `${status.label} is ${VERBS[sparkKind]}` });
        const played = await sparkTurn(k, sparkKind, room, setHouseOffer, (controller) => (abort.current = controller), setWs, holdOut);
        if (kind === "verdict") sparkVerdictDone.current = k.load().stateVersion;
        if (played) return;
        if (kind !== "verdict") say(`${status.label} stalled. The house dealt this one.`, "house");
      }

      setThinking({ player: "house", label: `The house is ${VERBS[kind]}` });
      await holdOut();
      await sleep(HOUSE_FEEL_MS);
      const latest = k.load();
      const move = houseMove(latest, now());
      // The room may have advanced during the reveal/feel delay. A missing
      // move now is a successful no-op, not a failed house attempt.
      if (!move || isPersonsTurn(latest, now())) return;
      const done = await exec("house", move);
      if (!done) {
        const failures = houseFailures.current.version === latest.stateVersion ? houseFailures.current.count + 1 : 1;
        houseFailures.current = { version: latest.stateVersion, count: failures };
        console.warn("[sting] house move failed", move?.type, failures);
        if (failures >= 2) {
          setGaveUp(latest.stateVersion);
          say("Nobody could make that move. It's yours.", "room");
        }
      }
    };

    void run()
      .catch((error) => say(String(error).slice(0, 120), "warm"))
      .finally(() => {
        busy.current = false;
        takeover.current = false;
        setThinking(null);
        setHouseOffer(false);
        setWs(k.load());
        setTurn((value) => value + 1);
      });
  }, [ws, status, turn, connected, agentSeen, fallback, gaveUp, exec, say, now]);

  // Keys 1 and 2 answer a duel.
  useEffect(() => {
    if (!ws || ws.phase !== "duel") return;
    const probe = openProbe(ws);
    if (!probe) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "1" && event.key !== "2") return;
      void act({ type: "react", probeRef: probe.ref, pick: event.key === "1" ? "a" : "b", dwellMs: 1200 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ws, act]);

  if (broken) {
    return (
      <div className="sting">
        <div className="sting-stage">
          <h1 className="sting-title">The saved room is unreadable.</h1>
          <p className="sting-body sting-muted">{broken}</p>
          <div className="sting-actions"><button className="sting-btn" onClick={startOver}>Start over</button></div>
        </div>
      </div>
    );
  }
  if (!ws) return <div className="sting" aria-busy="true" />;

  const visitingAgentIsCurrent = connected && !fallback && ws.record.externalAllowed && !ws.record.players.some((item) => item !== "chatgpt") && (isPersonsTurn(ws, now()) || canExternalAgentMove(ws, now()));
  const player: Player =
    fallback === "house" ? "house" : fallback === "spark" ? "spark" : ws.record.player === "spark" && status.enabled ? "spark" : ws.record.player === "chatgpt" && visitingAgentIsCurrent ? "chatgpt" : connected && agentSeen && visitingAgentIsCurrent ? "chatgpt" : ws.phase === "cast" && ws.lives.length === 0 && status.enabled ? "spark" : "house";
  const playerLabel = player === "spark" ? status.label : playerName(player);
  const screenProps = { ws, act, player, playerLabel, thinking: thinking?.label ?? null, ready: !thinking && (isPersonsTurn(ws, now()) || gaveUp === ws.stateVersion) };

  return (
    <div className="sting">
      <main className="sting-stage">
        {ws.phase !== "door" ? (
          <div className="strip" role="status" aria-live="polite">
            <div className="strip__inner">
              <span className="strip__who">
                <span className={`strip__dot ${player === "house" ? "strip__dot--house" : ""} ${thinking && !isPersonsTurn(ws, now()) ? "strip__dot--thinking" : ""}`} />
                <span>{isPersonsTurn(ws, now()) ? "Your choice" : thinking ? `${thinking.label}${elapsed >= 3 ? ` · ${elapsed}s` : ""}` : `${playerLabel} is here${player === "chatgpt" && ws.record.via ? ` via ${ws.record.via}` : ""}`}{clockOffset.current ? " · demo clock" : ""}</span>
              </span>
              <span className="strip__score">
                <span aria-label={`${ws.record.hits} right`}><b>{ws.record.hits}</b> ✓</span>
                <span aria-label={`${ws.record.misses} wrong`}><b>{ws.record.misses}</b> ✗</span>
                <Chips count={ws.record.chips} player={player} />
              </span>
            </div>
          </div>
        ) : null}
        {ws.phase === "door" && (
          <>
            <DoorScreen act={act} playerLabel={connected ? "Your AI" : status.label} enabled={connected || status.enabled} connected={connected} />
            <Preflight connected={connected} sparkEnabled={status.enabled} />
          </>
        )}
        {ws.phase === "cast" && <CastScreen {...screenProps} />}
        {ws.phase === "duel" && <DuelScreen {...screenProps} />}
        {ws.phase === "verdict" && <VerdictScreen {...screenProps} />}
        {ws.phase === "fight" && <FightScreen {...screenProps} />}
        {ws.phase === "lives" && <LivesScreen {...screenProps} />}
        {ws.phase === "dare" && <DareScreen {...screenProps} />}
        {ws.phase === "card" && <CardScreen ws={ws} playerLabel={playerLabel} onStartOver={startOver} thinking={thinking?.label ?? null} act={act} now={now} />}
        {ws.phase !== "door" ? <AuthorityStrip fallbackNames={toolsForRoom(ws, now())} active={connected && !fallback && !takeover.current} inactiveLabel={player === "house" ? "the house controls this room" : `${playerLabel} plays inside this page`} /> : null}
        {houseOffer && thinking && !isPersonsTurn(ws, now()) ? (
          <div className="sting-actions" style={{ flexWrap: "wrap", alignItems: "center" }}>
            <span className="sting-small">{connected && !agentSeen ? "Tell your agent: “play STING with me”. Or:" : "Still with you."}</span>
            {connected && !fallback && status.enabled ? (
              <button
                className="sting-btn sting-btn--ghost"
                onClick={() => void handTo("spark")}
              >
                Play {status.label} instead
              </button>
            ) : null}
            <button
              className="sting-btn sting-btn--quiet"
              onClick={() => {
                if (connected) {
                  void handTo("house");
                } else {
                  abort.current?.abort();
                }
              }}
            >
              Play the house instead
            </button>
          </div>
        ) : null}
      </main>
      {toast ? <Toast text={toast.text} tone={toast.tone} /> : null}
    </div>
  );
}

async function sparkTurn(
  k: StingKernel,
  kind: MoveKind,
  room: Workspace,
  setHouseOffer: (value: boolean) => void,
  registerAbort: (controller: AbortController) => void,
  onState: (ws: Workspace) => void,
  beforeApply: () => Promise<void>,
): Promise<boolean> {
  const controller = new AbortController();
  registerAbort(controller);
  const offer = window.setTimeout(() => setHouseOffer(true), HOUSE_OFFER_MS);
  try {
    const context = buildContext(room, navigator.language || "en", new Date().getHours());
    let denial: string | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await askSpark(kind, context, denial, controller.signal);
      if (!result.ok) {
        if (result.code === "SCHEMA_FAILED" && attempt === 0) {
          denial = `your JSON did not fit: ${result.detail ?? "invalid fields"}`;
          continue;
        }
        return false;
      }
      await beforeApply();
      const commands = commandFromOutput(k.load(), kind, result.value, "spark");
      let failed: string | undefined;
      for (const command of commands) {
        const latest = k.load();
        if (kind === "verdict" && alreadyOnTable(latest, command)) continue;
        const res = await k.execute("spark", { ...command, expectedVersion: latest.stateVersion, operationId: uuid() } as Command);
        if (!res.ok) {
          failed = `${res.code}: ${res.message}`;
          console.warn("[sting] denied spark", command.type, res.code, res.message);
          break;
        }
        onState(res.workspace);
      }
      if (!failed) return true;
      denial = failed;
    }
    return false;
  } finally {
    window.clearTimeout(offer);
    setHouseOffer(false);
  }
}

function alreadyOnTable(ws: Workspace, command: PendingMove): boolean {
  if (command.type !== "propose_hypothesis") return false;
  const same = ws.hypotheses.filter((item) => item.kind === command.kind && item.status !== "killed");
  if (command.kind === "hunger") return same.length >= 2 || same.some((item) => item.text === command.text);
  return same.length >= 1;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}
