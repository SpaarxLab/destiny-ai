import { MAX_DUELS, MIN_DUELS, QUESTION_COST, SLOW_DWELL_MS, answeredDuels, lifeByRef, openProbe, openQuestion, rulesOfMe, type Life, type Player, type Workspace } from "./domain";
import { houseMove } from "./driver";
import type { PendingMove } from "./kernel";
import type { MoveKind, MoveOutput, PlayerContext } from "./spark/schemas";

export type { PendingMove };

/** Which move the room needs from the player right now, if any. Mirrors the house driver's decisions. */
export function requiredMove(ws: Workspace): MoveKind | "fight" | "close" | null {
  const move = houseMove(ws);
  if (!move) return null;
  switch (move.type) {
    case "cast":
      return "cast";
    case "propose_hypothesis":
      return move.kind === "cold_read" ? "cold_read" : move.kind === "revision" ? "correction" : "verdict";
    case "stage_duel":
      return "duel";
    case "close_duels":
      return "close";
    case "stage_fight":
      return "fight";
    case "stage_lives":
      return "lives";
    case "propose_dare":
      return "dare";
    case "write_brief":
      return "brief";
    case "ask_once":
      return "question";
    case "seal_letter":
      return "letter";
    default:
      return null;
  }
}

function bucket(ws: Workspace, ms: number): "fast" | "medium" | "slow" | "off" {
  if (!ws.settings.timing) return "off";
  if (ms >= SLOW_DWELL_MS) return "slow";
  if (ms < 1000) return "fast";
  return "medium";
}

/** What the player may see. Its own bets are visible to it; nothing typed elsewhere ever enters. */
export function buildContext(ws: Workspace, locale: string, hour: number): PlayerContext {
  const lifeInfo = (ref: string) => {
    const life = ws.lives.find((item) => item.ref === ref);
    return { ref, line: life?.line ?? "", dwell: bucket(ws, ws.picks.dwell[ref] ?? 0) };
  };
  const duels = ws.reactions.map((reaction) => {
    const probe = ws.probes.find((item) => item.ref === reaction.probeRef)!;
    const picked = lifeByRef(ws, reaction.pickedLifeRef);
    return {
      reactionRef: reaction.ref,
      testsLifeRef: probe.testsLifeRef,
      a: probe.lives[0].line,
      b: probe.lives[1].line,
      axis: probe.lives[0].axis,
      variable: probe.variable ?? "",
      myBet: probe.bet ?? { pick: "a" as const, chips: 1, because: "" },
      picked: reaction.pick,
      pickedLine: picked?.line ?? "",
      outcome: reaction.betOutcome === "hit" ? ("hit" as const) : ("miss" as const),
      dwell: bucket(ws, reaction.dwellMs),
      corrected: reaction.corrected,
    };
  });
  const tested = new Set(ws.probes.filter((probe) => probe.kind === "duel").map((probe) => probe.testsLifeRef));
  const required = [...ws.picks.stings, ...(ws.picks.secret ? [ws.picks.secret] : [])];
  const untested = required.filter((ref) => !tested.has(ref)).map((ref) => ws.lives.find((life) => life.ref === ref)!).filter(Boolean);
  const cold = ws.hypotheses.find((item) => item.kind === "cold_read");
  const crowned = ws.hypotheses.find((item) => item.status === "crowned");
  const chosen = ws.posters.find((poster) => poster.ref === ws.chosenPoster);
  return {
    phase: ws.phase,
    locale: locale.slice(0, 12),
    hour,
    record: { chips: ws.record.chips, hits: ws.record.hits, misses: ws.record.misses, earned: ws.record.earned, bust: ws.record.bust },
    lives: ws.lives.map(({ ref, line, axis, pole }) => ({ ref, line, axis, pole })),
    picks: { stings: ws.picks.stings.map(lifeInfo), secret: ws.picks.secret ? lifeInfo(ws.picks.secret) : undefined, secretSkipped: ws.picks.secretSkipped },
    duels: duels.slice(-12),
    untested: untested.map(({ ref, line, axis, pole }) => ({ ref, line, axis, pole })),
    coldRead: cold?.text || undefined,
    lines: ws.hypotheses.filter((item) => item.kind !== "cold_read" && item.kind !== "revision").map((item) => ({ kind: item.kind, text: item.text, status: item.status })),
    killed: ws.kills.map((kill) => kill.text),
    crowned: crowned?.text,
    chosenLife: chosen ? { line: chosen.line, axis: chosen.axis, pole: chosen.pole } : undefined,
    dare: ws.dare ? { action: ws.dare.action, doneLooksLike: ws.dare.doneLooksLike, days: ws.dare.days, hours: ws.dare.hours, money: ws.dare.money, currency: ws.dare.currency } : undefined,
    questions: ws.questions.slice(-3).map((question) => ({ text: question.text, answer: question.choice === undefined ? null : question.options[question.choice] })),
    allowed: allowedTurnMoves(ws),
    rulesOfMe: rulesOfMe(ws).slice(0, 20).map((rule) => rule.slice(0, 200)),
    letter: ws.letter ? { status: ws.letter.status, opensAt: ws.letter.opensAt } : undefined,
  };
}

/** What a model player may choose between during the duels. Mirrors the kernel's rules for stage_duel, ask_once and close_duels. */
export function allowedTurnMoves(ws: Workspace): ("duel" | "question" | "close")[] {
  if (ws.phase !== "duel" || openProbe(ws) || openQuestion(ws) || ws.record.bust) return [];
  const last = ws.reactions.at(-1);
  if (last && last.betOutcome === "miss" && !last.corrected) return [];
  const done = answeredDuels(ws);
  const out: ("duel" | "question" | "close")[] = [];
  if (done.length < MAX_DUELS) out.push("duel");
  if (ws.questions.length === 0 && ws.record.chips > QUESTION_COST) out.push("question");
  const tested = new Set(done.map((probe) => probe.testsLifeRef).filter(Boolean));
  const required = [...ws.picks.stings, ...(ws.picks.secret ? [ws.picks.secret] : [])];
  if (done.length >= MIN_DUELS && required.every((ref) => tested.has(ref))) out.push("close");
  return out;
}

/** Turn a model output into the kernel command for that move. Refs are assigned here, never by the model. */
export function commandFromOutput<K extends MoveKind>(ws: Workspace, move: K, output: MoveOutput[K], player: Player): PendingMove[] {
  const base = { expectedVersion: ws.stateVersion, player };
  const v = ws.stateVersion + 1;
  switch (move) {
    case "cast": {
      const value = output as MoveOutput["cast"];
      const lives: Life[] = value.lives.map((life, index) => ({ ref: `life-${v}-${index + 1}`, line: life.line, scene: life.scene, axis: life.axis, pole: life.pole }));
      return [{ ...base, type: "cast", lives, aside: value.aside }];
    }
    case "cold_read": {
      const value = output as MoveOutput["cold_read"];
      return [{ ...base, type: "propose_hypothesis", kind: "cold_read", text: value.text }];
    }
    case "duel": {
      const value = output as MoveOutput["duel"];
      const a: Life = { ref: `duel-${v}-a`, line: value.a.line, scene: value.a.scene, axis: value.axis, pole: "a" };
      const b: Life = { ref: `duel-${v}-b`, line: value.b.line, scene: value.b.scene, axis: value.axis, pole: "b" };
      const tested = new Set(ws.probes.filter((probe) => probe.kind === "duel").map((probe) => probe.testsLifeRef));
      const required = [...ws.picks.stings, ...(ws.picks.secret ? [ws.picks.secret] : [])];
      const fallbackTarget = required.find((ref) => !tested.has(ref));
      const testsLifeRef = ws.lives.some((life) => life.ref === value.testsLifeRef) ? value.testsLifeRef : fallbackTarget;
      return [{ ...base, type: "stage_duel", lives: [a, b], variable: value.variable, bet: value.bet, testsLifeRef, aside: value.aside }];
    }
    case "correction": {
      const value = output as MoveOutput["correction"];
      const last = [...ws.reactions].reverse().find((reaction) => reaction.betOutcome === "miss" && !reaction.corrected);
      if (!last) return [];
      return [{ ...base, type: "propose_hypothesis", kind: "revision", text: value.text, revises: last.ref, correction: value.correction }];
    }
    case "verdict": {
      const value = output as MoveOutput["verdict"];
      const refs = (claimed: string[]) => groundProofRefs(ws, claimed);
      const moves: PendingMove[] = [{ ...base, type: "propose_hypothesis", kind: "hunger", text: value.hunger.text, proofRefs: refs(value.hunger.proofRefs) }];
      if (value.hunger2) moves.push({ ...base, type: "propose_hypothesis", kind: "hunger", text: value.hunger2.text, proofRefs: refs(value.hunger2.proofRefs) });
      if (value.mask) moves.push({ ...base, type: "propose_hypothesis", kind: "mask", text: value.mask.text, proofRefs: refs(value.mask.proofRefs) });
      moves.push({ ...base, type: "propose_hypothesis", kind: "edge", text: value.edge.text, proofRefs: refs(value.edge.proofRefs) });
      return moves;
    }
    case "lives": {
      const value = output as MoveOutput["lives"];
      return [{ ...base, type: "stage_lives", posters: value.posters.map((poster, index) => ({ ref: `poster-${v}-${index + 1}`, ...poster })) }];
    }
    case "dare": {
      const value = output as MoveOutput["dare"];
      return [{ ...base, type: "propose_dare", dare: value }];
    }
    case "brief": {
      const value = output as MoveOutput["brief"];
      return [{ ...base, type: "write_brief", text: value.brief }];
    }
    case "question": {
      const value = output as MoveOutput["question"];
      return [{ ...base, type: "ask_once", text: value.text, options: value.options, aside: value.aside }];
    }
    case "letter": {
      const value = output as MoveOutput["letter"];
      return [{ ...base, type: "seal_letter", willDo: value.willDo, feeling: value.feeling, note: value.note, aside: value.aside }];
    }
    case "turn": {
      const value = output as MoveOutput["turn"];
      if (value.move === "close") return [{ ...base, type: "close_duels", aside: value.aside }];
      if (value.move === "question") return commandFromOutput(ws, "question", value, player);
      return commandFromOutput(ws, "duel", value, player);
    }
    default:
      return [];
  }
}

/**
 * Models mangle refs ("react-12 (slow)", "reaction 12"). Keep only refs that exist, then pad to three with the
 * strongest real taps: a miss or a slow tap first, then the most recent. The kernel still verifies every ref.
 */
export function groundProofRefs(ws: Workspace, claimed: string[]): string[] {
  const real = new Set(ws.reactions.map((reaction) => reaction.ref));
  const cleaned = claimed
    .map((ref) => ref.trim().split(/\s+/)[0]?.replace(/[^\w-]/g, "") ?? "")
    .map((ref) => (real.has(ref) ? ref : real.has(`react-${ref.replace(/\D/g, "")}`) ? `react-${ref.replace(/\D/g, "")}` : ""))
    .filter((ref, index, list) => ref && list.indexOf(ref) === index);
  const strong = ws.reactions.filter((reaction) => reaction.betOutcome === "miss" || reaction.dwellMs >= SLOW_DWELL_MS).map((reaction) => reaction.ref);
  const rest = [...ws.reactions].reverse().map((reaction) => reaction.ref);
  const out = [...cleaned];
  for (const ref of [...strong, ...rest]) {
    if (out.length >= 3 && out.some((item) => strong.includes(item))) break;
    if (!out.includes(ref)) out.push(ref);
    if (out.length >= 6) break;
  }
  return out.slice(0, 6);
}

export interface PlayerStatus {
  enabled: boolean;
  model: string;
  label: string;
}

export async function fetchPlayerStatus(): Promise<PlayerStatus> {
  try {
    const response = await fetch("/api/sting/move", { cache: "no-store" });
    if (!response.ok) return { enabled: false, model: "", label: "The house" };
    const value = (await response.json()) as { enabled: boolean; model: string; label: string };
    return { enabled: Boolean(value.enabled), model: value.model, label: value.label || "Spark" };
  } catch {
    return { enabled: false, model: "", label: "The house" };
  }
}

export type SparkResult<K extends MoveKind> =
  | { ok: true; value: MoveOutput[K]; model: string; ms: number }
  | { ok: false; code: string; detail?: string };

export async function askSpark<K extends MoveKind>(move: K, context: PlayerContext, denial?: string, signal?: AbortSignal): Promise<SparkResult<K>> {
  try {
    const response = await fetch("/api/sting/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ move, context, denial }),
      signal,
    });
    const value = (await response.json()) as { ok: boolean; value?: MoveOutput[K]; model?: string; ms?: number; code?: string; detail?: string };
    if (!response.ok || !value.ok || !value.value) return { ok: false, code: value.code ?? `http_${response.status}`, detail: value.detail };
    return { ok: true, value: value.value, model: value.model ?? "", ms: value.ms ?? 0 };
  } catch (error) {
    return { ok: false, code: signal?.aborted ? "ABORTED" : "NETWORK", detail: String(error).slice(0, 80) };
  }
}

export function isPersonsTurn(ws: Workspace): boolean {
  if (openQuestion(ws)) return true;
  if (ws.phase === "duel") return Boolean(openProbe(ws));
  return requiredMove(ws) === null;
}
