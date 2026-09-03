import { AXIS_DUELS, DUEL_POLES, HOUSE_LIVES, POSTER_TEMPLATES, VERDICT_ME, VERDICT_TEMPLATES } from "./content";
import {
  AXES,
  EARN_CHIPS,
  MAX_DUELS,
  MIN_DUELS,
  SLOW_DWELL_MS,
  answeredDuels,
  lifeByRef,
  type Axis,
  type Bet,
  type Life,
  type LifePoster,
  type Pole,
  type Reaction,
  type Workspace,
} from "./domain";
import type { Command } from "./kernel";

const HOUSE_TARGET_DUELS = 7;

type AxisPole = `${Axis}:${Pole}`;

export function houseCast(): Life[] {
  return HOUSE_LIVES.map(({ ref, line, scene, axis, pole }) => ({ ref, line, scene, axis, pole }));
}

export function houseColdRead(ws: Workspace): string {
  const first = ws.lives.find((life) => life.ref === ws.picks.stings[0]);
  if (!first) return "Wants what it tapped first.";
  return VERDICT_TEMPLATES[first.axis][first.pole].hunger;
}

/** Score every axis:pole from stings, secret and duel picks. Positive means the person leans there. */
export function axisPoleScores(ws: Workspace): Map<AxisPole, number> {
  const scores = new Map<AxisPole, number>();
  const bump = (axis: Axis, pole: Pole, by: number) => {
    const key: AxisPole = `${axis}:${pole}`;
    scores.set(key, (scores.get(key) ?? 0) + by);
  };
  for (const ref of [...ws.picks.stings, ...(ws.picks.secret ? [ws.picks.secret] : [])]) {
    const life = ws.lives.find((item) => item.ref === ref);
    if (life) bump(life.axis, life.pole, 1);
  }
  for (const reaction of ws.reactions) {
    const life = lifeByRef(ws, reaction.pickedLifeRef);
    if (life) bump(life.axis, life.pole, reaction.dwellMs >= SLOW_DWELL_MS ? 1 : 2);
  }
  return scores;
}

function duelledRefs(ws: Workspace): Set<string> {
  return new Set(ws.probes.filter((probe) => probe.kind === "duel").map((probe) => probe.testsLifeRef ?? ""));
}

export function houseShouldClose(ws: Workspace): boolean {
  const done = answeredDuels(ws).length;
  if (ws.record.bust) return true;
  const required = [...ws.picks.stings, ...(ws.picks.secret ? [ws.picks.secret] : [])];
  const tested = duelledRefs(ws);
  const allTested = required.every((ref) => tested.has(ref));
  if (!allTested) return false;
  if (done >= MAX_DUELS) return true;
  if (done >= MIN_DUELS && ws.record.earned) return true;
  // Keep playing past the comfortable target only while earning is still arithmetically possible.
  const remaining = MAX_DUELS - done;
  if (done >= HOUSE_TARGET_DUELS && ws.record.chips + remaining * 3 < EARN_CHIPS) return true;
  return false;
}

export function houseNextDuel(ws: Workspace): Extract<Command, { type: "stage_duel" }> | null {
  const tested = duelledRefs(ws);
  const required = [...ws.picks.stings, ...(ws.picks.secret ? [ws.picks.secret] : [])];
  const order = [...required, ...HOUSE_LIVES.map((life) => life.ref).filter((ref) => !required.includes(ref))];
  const onTable = ws.lives.map((life) => life.ref);
  const candidates = [...order, ...onTable].filter((ref) => onTable.includes(ref) || HOUSE_LIVES.some((life) => life.ref === ref));
  const nextRef = candidates.find((ref) => !tested.has(ref));
  if (!nextRef) return null;
  const houseSource = HOUSE_LIVES.find((life) => life.ref === nextRef);
  const tableLife = ws.lives.find((life) => life.ref === nextRef);
  const duel = houseSource ? houseSource.duel : AXIS_DUELS[tableLife?.axis ?? "visible_hidden"];
  const poles = houseSource ? DUEL_POLES[nextRef] : { axis: tableLife?.axis ?? "visible_hidden", a: "a" as Pole, b: "b" as Pole };
  const a: Life = { ref: `${nextRef}-a-${ws.stateVersion + 1}`, line: duel.a, scene: duel.sceneA, axis: poles.axis, pole: poles.a };
  const b: Life = { ref: `${nextRef}-b-${ws.stateVersion + 1}`, line: duel.b, scene: duel.sceneB, axis: poles.axis, pole: poles.b };
  const bet = houseBet(ws, a, b, (houseSource ?? tableLife)?.line ?? "that one");
  return {
    type: "stage_duel",
    operationId: "",
    expectedVersion: ws.stateVersion,
    player: "house",
    lives: [a, b],
    variable: duel.variable,
    bet,
    testsLifeRef: nextRef,
  };
}

function houseBet(ws: Workspace, a: Life, b: Life, sourceLine: string): Bet {
  // Stings are envy of a whole life; the duel strips it, and the strip usually cuts against the sting.
  // So the house bets only on what the thumb has already done in duels: same-axis picks count double,
  // the overall side tendency counts once.
  let axisLean = 0;
  let sideLean = 0;
  for (const reaction of ws.reactions) {
    const picked = lifeByRef(ws, reaction.pickedLifeRef);
    if (!picked) continue;
    sideLean += reaction.pick === "b" ? 1 : -1;
    if (picked.axis === a.axis) axisLean += picked.pole === b.pole ? 2 : -2;
  }
  const total = axisLean + sideLean;
  const priorSide: Pole = "b"; // when forced, people keep the quiet thing and drop the prestige thing
  const pick: Pole = total > 0 ? "b" : total < 0 ? "a" : priorSide;
  const strength = Math.abs(total);
  const stake = (strength >= 4 ? 3 : strength >= 2 ? 2 : 1) as Bet["chips"];
  const safeStake = Math.max(1, Math.min(stake, ws.record.chips)) as Bet["chips"];
  const because =
    strength === 0
      ? `A guess. "${shorten(sourceLine)}" stung, that's all I know.`
      : strength < 4
        ? `You've leaned this way before.`
        : `You've gone this way every time so far.`;
  return { pick, chips: safeStake, because: because.slice(0, 80) };
}

function shorten(text: string, max = 28): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function houseCorrection(ws: Workspace, reaction: Reaction): { text: string; correction: string } {
  const probe = ws.probes.find((item) => item.ref === reaction.probeRef)!;
  // A model may phrase the variable any way it likes; only the "x or y" form names both sides.
  const parts = (probe.variable ?? "").split(/\s+or\s+/i).map((part) => part.trim()).filter(Boolean);
  const [x, y] = parts.length === 2 ? parts : [probe.lives[0].line.replace(/[.!?]$/, ""), probe.lives[1].line.replace(/[.!?]$/, "")];
  const pickedB = reaction.pick === "b";
  const wanted = pickedB ? y : x;
  const dropped = pickedB ? x : y;
  return {
    text: `I thought ${dropped}. You picked ${wanted}.`,
    correction: `I misread you. Not ${dropped}. ${capitalize(wanted)}.`.slice(0, 120),
  };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface HouseVerdict {
  hunger: { text: string; proofRefs: string[]; axis: Axis; pole: Pole };
  hunger2?: { text: string; proofRefs: string[]; axis: Axis; pole: Pole };
  mask?: { text: string; proofRefs: string[] };
  edge: { text: string; proofRefs: string[]; axis: Axis; pole: Pole };
}

export function houseVerdict(ws: Workspace): HouseVerdict {
  const scores = axisPoleScores(ws);
  const ranked = [...scores.entries()].sort((left, right) => right[1] - left[1]);
  const reactionsFor = (axis: Axis, pole: Pole) =>
    ws.reactions.filter((reaction) => {
      const life = lifeByRef(ws, reaction.pickedLifeRef);
      return life?.axis === axis && life.pole === pole;
    });
  const miss = ws.reactions.find((reaction) => reaction.betOutcome === "miss");
  const slow = ws.reactions.find((reaction) => reaction.dwellMs >= SLOW_DWELL_MS);
  const anchor = miss ?? slow;

  const withAnchor = (refs: string[]) => {
    const set = new Set(refs);
    if (anchor) set.add(anchor.ref);
    // pad to three with the strongest picks in the same family
    for (const reaction of ws.reactions) {
      if (set.size >= 3) break;
      set.add(reaction.ref);
    }
    return [...set];
  };

  const [topKey] = ranked[0] ?? [`${AXES[0]}:b` as AxisPole];
  const [topAxis, topPole] = topKey.split(":") as [Axis, Pole];
  const hunger = {
    text: VERDICT_TEMPLATES[topAxis][topPole].hunger,
    proofRefs: withAnchor(reactionsFor(topAxis, topPole).map((reaction) => reaction.ref)),
    axis: topAxis,
    pole: topPole,
  };

  const second = ranked.find(([key]) => key.split(":")[0] !== topAxis);
  let hunger2: HouseVerdict["hunger2"];
  if (second) {
    const [axis, pole] = second[0].split(":") as [Axis, Pole];
    hunger2 = { text: VERDICT_TEMPLATES[axis][pole].hunger, proofRefs: withAnchor(reactionsFor(axis, pole).map((reaction) => reaction.ref)), axis, pole };
  }

  // Mask: a life the person stung for whose duel they then picked against.
  let mask: HouseVerdict["mask"];
  for (const ref of [...ws.picks.stings, ...(ws.picks.secret ? [ws.picks.secret] : [])]) {
    const probe = ws.probes.find((item) => item.kind === "duel" && item.testsLifeRef === ref);
    const life = ws.lives.find((item) => item.ref === ref);
    const reaction = probe && ws.reactions.find((item) => item.probeRef === probe.ref);
    if (!probe || !life || !reaction) continue;
    const kept = probe.lives[reaction.pick === "a" ? 0 : 1];
    if (kept.pole !== life.pole || kept.axis !== life.axis) {
      mask = { text: VERDICT_TEMPLATES[life.axis][life.pole].mask, proofRefs: withAnchor([reaction.ref]) };
      break;
    }
  }

  // Edge: the axis the person answered fastest.
  const timed = ws.reactions.filter((reaction) => reaction.dwellMs > 0);
  const fastest = [...(timed.length ? timed : ws.reactions)].sort((left, right) => left.dwellMs - right.dwellMs).slice(0, 3);
  const edgeLife = fastest[0] ? lifeByRef(ws, fastest[0].pickedLifeRef) : undefined;
  const edgeAxis = edgeLife?.axis ?? topAxis;
  const edgePole = edgeLife?.pole ?? topPole;
  const edge = { text: VERDICT_TEMPLATES[edgeAxis][edgePole].edge, proofRefs: withAnchor(fastest.map((reaction) => reaction.ref)), axis: edgeAxis, pole: edgePole };

  return { hunger, hunger2, mask, edge };
}

export function housePosters(ws: Workspace): LifePoster[] {
  const crowned = ws.hypotheses.find((item) => item.kind === "hunger" && (item.status === "crowned" || item.status === "kept"));
  const scores = axisPoleScores(ws);
  const ranked = [...scores.entries()].sort((left, right) => right[1] - left[1]).map(([key]) => key.split(":") as [Axis, Pole]);
  const chosen: [Axis, Pole][] = [];
  const crownedMatch = crowned ? findTemplateAxis(crowned.text) : undefined;
  if (crownedMatch) chosen.push(crownedMatch);
  for (const pair of ranked) {
    if (chosen.length >= 3) break;
    if (!chosen.some(([axis]) => axis === pair[0])) chosen.push(pair);
  }
  for (const axis of AXES) {
    if (chosen.length >= 3) break;
    if (!chosen.some(([existing]) => existing === axis)) chosen.push([axis, "b"]);
  }
  return chosen.slice(0, 3).map(([axis, pole]) => {
    const template = POSTER_TEMPLATES[axis][pole];
    return { ref: `poster-${axis}-${pole}`, axis, pole, line: template.line, scene: template.scene, week: template.week, tradeoff: template.tradeoff, question: template.question };
  });
}

function findTemplateAxis(hungerText: string): [Axis, Pole] | undefined {
  for (const axis of AXES) {
    for (const pole of ["a", "b"] as const) {
      if (VERDICT_TEMPLATES[axis][pole].hunger === hungerText) return [axis, pole];
    }
  }
  return undefined;
}

export function houseDare(ws: Workspace): Extract<Command, { type: "propose_dare" }>["dare"] | null {
  const poster = ws.posters.find((item) => item.ref === ws.chosenPoster);
  if (!poster) return null;
  const template = POSTER_TEMPLATES[poster.axis][poster.pole].dare;
  return { action: template.action, doneLooksLike: template.doneLooksLike, days: template.days, hours: template.hours, money: 0, currency: "INR" };
}

/** First-person line for a kept verdict line, when it came from a house template. Model-written lines are rewritten lightly. */
export function firstPerson(text: string, kind: "hunger" | "mask" | "edge"): string {
  for (const axis of AXES) {
    for (const pole of ["a", "b"] as const) {
      if (VERDICT_TEMPLATES[axis][pole][kind] === text) return VERDICT_ME[axis][pole][kind];
    }
  }
  const lower = text.charAt(0).toLowerCase() + text.slice(1);
  if (/^to /i.test(text)) return `I want ${lower.slice(3)}`;
  return lower
    .replace(/\byou are\b/g, "I am")
    .replace(/\byou're\b/g, "I'm")
    .replace(/\byour\b/g, "my")
    .replace(/\byourself\b/g, "myself")
    .replace(/\byou\b/g, "I")
    .replace(/^i /, "I ")
    .replace(/^(\w)/, (c) => c.toUpperCase());
}

export function houseBrief(ws: Workspace): string {
  const kept = (kind: "hunger" | "mask" | "edge") => ws.hypotheses.find((item) => item.kind === kind && (item.status === "crowned" || item.status === "kept"));
  const hunger = kept("hunger");
  const mask = kept("mask");
  const edge = kept("edge");
  const fast = ws.reactions.filter((reaction) => reaction.dwellMs > 0 && reaction.dwellMs < 1000).map((reaction) => lifeByRef(ws, reaction.pickedLifeRef)?.line).filter(Boolean).slice(0, 3);
  const slow = ws.reactions.filter((reaction) => reaction.dwellMs >= SLOW_DWELL_MS).map((reaction) => lifeByRef(ws, reaction.pickedLifeRef)?.line).filter(Boolean).slice(0, 2);
  const parts = [
    "YOUR SIGNAL",
    hunger ? firstPerson(hunger.text, "hunger") : "No single want survived. Treat the choices below as signals, not a verdict.",
    edge ? `${firstPerson(edge.text, "edge")} I may undersell it because it feels ordinary to me.` : "",
    fast.length ? `I moved quickly toward ${fast.map((line) => `"${line}"`).join(", ")}.` : "",
    "THE LIVE TENSION",
    slow.length ? `I slowed down around ${slow.map((line) => `"${line}"`).join(", ")}. Do not solve that tension for me; help me test it.` : "I did not give you a clean contradiction. Keep your certainty low and ask before you conclude.",
    mask ? `One story I crossed out: ${firstPerson(mask.text, "mask")}. Do not smuggle it back in.` : "",
  ].filter(Boolean);
  return parts.join("\n");
}


/** The house's one question: whichever axis the taps split on most evenly, asked as a plain choice. */
export function houseQuestion(ws: Workspace): { text: string; options: [string, string, string] } | null {
  const scores = axisPoleScores(ws);
  let best: { axis: (typeof AXES)[number]; gap: number } | null = null;
  for (const axis of AXES) {
    const a = scores.get(`${axis}:a` as AxisPole) ?? 0;
    const b = scores.get(`${axis}:b` as AxisPole) ?? 0;
    if (a + b === 0) continue;
    const gap = Math.abs(a - b);
    if (!best || gap < best.gap) best = { axis, gap };
  }
  if (!best) return null;
  const questions: Record<(typeof AXES)[number], { text: string; options: [string, string, string] }> = {
    autonomy_belonging: { text: "A free Saturday, nobody has plans. What do you do?", options: ["Go somewhere alone", "Call someone over", "Wait and see who calls"] },
    depth_breadth: { text: "You get one year fully paid. What do you do with it?", options: ["Go deep on one thing", "Try five things", "Fix what I already do"] },
    making_deciding: { text: "The team is stuck. What do you reach for first?", options: ["Build the fix myself", "Call the decision", "Ask who is closest to it"] },
    visible_hidden: { text: "The thing worked. Who do you tell?", options: ["Everyone, that day", "One person, quietly", "Nobody yet"] },
    stability_risk: { text: "A stranger offers you an odd job for double pay. You?", options: ["Take it this week", "Ask for the details first", "Keep what I have"] },
    people_things: { text: "Long day. What actually restored you?", options: ["A person", "A thing I made", "Silence"] },
  };
  return questions[best.axis];
}

/** The house seals a plain, honest letter: it bets on the dare being done when the person answered fast. */
export function houseLetter(ws: Workspace): { willDo: boolean; feeling: string; note: string } {
  const fast = ws.reactions.filter((reaction) => reaction.dwellMs > 0 && reaction.dwellMs < 1000).length;
  const slow = ws.reactions.filter((reaction) => reaction.dwellMs >= SLOW_DWELL_MS).length;
  const willDo = fast >= slow;
  const chosen = ws.posters.find((poster) => poster.ref === ws.chosenPoster);
  const note = willDo
    ? `You picked "${chosen?.line ?? "that life"}" without much pause. I bet the week went the same way: quicker than you expected, and you kept going after done.`
    : `You paused on "${chosen?.line ?? "that life"}". I bet the week got in the way. If it did, that pause was the real answer, and it is worth a second look.`;
  return { willDo, feeling: willDo ? "lighter" : "unfinished", note };
}
