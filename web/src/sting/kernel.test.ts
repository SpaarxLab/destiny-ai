import { describe, expect, it } from "vitest";
import { EARN_CHIPS, START_CHIPS, openProbe, type Workspace, openQuestion } from "./domain";
import { houseMove } from "./driver";
import { chainHash, verifyCommitment } from "./hash";
import { StingKernel, participantView, type Command, type PendingMove } from "./kernel";
import { MemoryStore } from "./store";

const answeredDuelsCount = (ws: Workspace) => ws.probes.filter((p) => p.kind === "duel" && p.status === "answered").length;
let counter = 0;
const op = () => `op-${++counter}`;

async function run(kernel: StingKernel, actor: "participant" | "house" | "spark", command: PendingMove, operationId = op()) {
  const result = await kernel.execute(actor, { ...command, operationId } as Command);
  if (!result.ok) throw new Error(`${command.type} denied: ${result.code} ${result.message}`);
  return result.workspace;
}

/** Let the house make every move it can, then return the room. */
async function houseTurn(kernel: StingKernel, ws: Workspace): Promise<Workspace> {
  let current = ws;
  for (let i = 0; i < 12; i += 1) {
    const question = openQuestion(current);
    if (question) {
      // The house's one paid question: the person answers by tapping the middle option.
      current = await run(kernel, "participant", { type: "answer_question", expectedVersion: current.stateVersion, questionRef: question.ref, choice: 1 });
      continue;
    }
    const move = houseMove(current);
    if (!move) return current;
    current = await run(kernel, "house", move);
  }
  return current;
}

/** A person who keeps the quiet side ("b") except once, on the third duel, so the house must be wrong at least once. */
async function playMatch(kernel: StingKernel, opts: { pick?: (ws: Workspace) => "a" | "b"; dwell?: number } = {}) {
  let ws = await run(kernel, "participant", { type: "start", expectedVersion: 0 });
  ws = await houseTurn(kernel, ws);
  expect(ws.lives).toHaveLength(8);
  ws = await run(kernel, "participant", { type: "pick_life", expectedVersion: ws.stateVersion, lifeRef: "life-sold", dwellMs: 3200 });
  ws = await run(kernel, "participant", { type: "pick_life", expectedVersion: ws.stateVersion, lifeRef: "life-fixer", dwellMs: 700 });
  ws = await run(kernel, "participant", { type: "pick_life", expectedVersion: ws.stateVersion, lifeRef: "life-stage", dwellMs: 1800 });
  expect(ws.phase).toBe("duel");
  for (let i = 0; i < 12 && ws.phase === "duel"; i += 1) {
    ws = await houseTurn(kernel, ws);
    const probe = openProbe(ws);
    if (!probe) break;
    const pick = opts.pick ? opts.pick(ws) : ws.reactions.length === 2 ? "a" : "b";
    ws = await run(kernel, "participant", { type: "react", expectedVersion: ws.stateVersion, probeRef: probe.ref, pick, dwellMs: opts.dwell ?? 900 });
  }
  ws = await houseTurn(kernel, ws);
  return ws;
}

describe("STING kernel: the house match", () => {
  it("plays a whole match with zero network and ends on a card", async () => {
    const kernel = new StingKernel(new MemoryStore());
    let ws = await playMatch(kernel);
    expect(ws.phase).toBe("verdict");
    ws = await houseTurn(kernel, ws);
    const kinds = ws.hypotheses.filter((h) => h.status === "proposed").map((h) => h.kind).sort();
    expect(ws.record.earned).toBe(true);
    expect(kinds).toContain("hunger");
    expect(kinds).toContain("edge");
    const coldRead = ws.hypotheses.find((h) => h.kind === "cold_read")!;
    expect(coldRead.status).toBe("revealed");

    ws = await run(kernel, "participant", { type: "keep_all", expectedVersion: ws.stateVersion });
    if (ws.phase === "fight") {
      ws = await houseTurn(kernel, ws);
      expect(ws.fight?.status).toBe("open");
      ws = await run(kernel, "participant", { type: "crown", expectedVersion: ws.stateVersion, hypothesisRef: ws.fight!.refs[0] });
      expect(ws.hypotheses.find((h) => h.ref === ws.fight!.refs[1])!.status).toBe("burned");
    }
    expect(ws.phase).toBe("lives");
    ws = await houseTurn(kernel, ws);
    expect(ws.posters).toHaveLength(3);
    ws = await run(kernel, "participant", { type: "choose_poster", expectedVersion: ws.stateVersion, posterRef: ws.posters[0].ref });
    ws = await houseTurn(kernel, ws);
    expect(ws.dare?.status).toBe("proposed");
    ws = await run(kernel, "participant", { type: "accept_dare", expectedVersion: ws.stateVersion, hours: 4, money: 0, currency: "INR" });
    expect(ws.phase).toBe("card");
    expect(ws.dare?.dueAt).toBeTruthy();
    ws = await houseTurn(kernel, ws);
    expect(ws.brief?.text).toContain("YOUR SIGNAL");
    expect(ws.brief?.text).toMatch(/^YOUR SIGNAL\nI want /);
  });

  it("keeps the bet sealed in the participant view until the tap, then reveals it with a verifiable commitment", async () => {
    const kernel = new StingKernel(new MemoryStore());
    let ws = await run(kernel, "participant", { type: "start", expectedVersion: 0 });
    ws = await houseTurn(kernel, ws);
    for (const ref of ["life-sold", "life-fixer", "life-stage"]) {
      ws = await run(kernel, "participant", { type: "pick_life", expectedVersion: ws.stateVersion, lifeRef: ref, dwellMs: 1000 });
    }
    ws = await houseTurn(kernel, ws);
    const probe = openProbe(ws)!;
    expect(probe.bet).toBeDefined();
    const view = participantView(ws);
    const viewProbe = view.probes.find((p) => p.ref === probe.ref)!;
    expect(viewProbe.bet).toBeUndefined();
    expect(viewProbe.commitment).toHaveLength(4);
    const cold = view.hypotheses.find((h) => h.kind === "cold_read")!;
    expect(cold.text).toBe("");

    ws = await run(kernel, "participant", { type: "react", expectedVersion: ws.stateVersion, probeRef: probe.ref, pick: "b", dwellMs: 800 });
    const revealed = participantView(ws).probes.find((p) => p.ref === probe.ref)!;
    expect(revealed.bet).toBeDefined();
    expect(await verifyCommitment(revealed.bet, probe.operationId, revealed.commitment!)).toBe(true);
  });

  it("moves chips by the stake and marks earned only at the threshold with a corrected miss", async () => {
    const kernel = new StingKernel(new MemoryStore());
    const ws = await playMatch(kernel, { pick: (room) => (room.reactions.length === 0 ? "a" : "b") });
    const moved = ws.reactions.reduce((sum, r) => sum + r.chipsMoved, 0);
    const asked = ws.questions.reduce((sum, q) => sum + q.chipsCost, 0);
    expect(asked).toBe(1);
    expect(ws.record.chips).toBe(START_CHIPS + moved - asked);
    expect(ws.record.misses).toBeGreaterThanOrEqual(1);
    expect(ws.reactions.filter((r) => r.betOutcome === "miss").every((r) => r.corrected)).toBe(true);
    expect(ws.record.earned).toBe(ws.record.chips >= EARN_CHIPS);
  });

  it("denies a second bet after a miss until the house says what it misread", async () => {
    const kernel = new StingKernel(new MemoryStore());
    let ws = await run(kernel, "participant", { type: "start", expectedVersion: 0 });
    ws = await houseTurn(kernel, ws);
    for (const ref of ["life-sold", "life-fixer", "life-stage"]) {
      ws = await run(kernel, "participant", { type: "pick_life", expectedVersion: ws.stateVersion, lifeRef: ref, dwellMs: 1000 });
    }
    ws = await houseTurn(kernel, ws);
    const probe = openProbe(ws)!;
    const against = probe.bet!.pick === "a" ? "b" : "a";
    ws = await run(kernel, "participant", { type: "react", expectedVersion: ws.stateVersion, probeRef: probe.ref, pick: against, dwellMs: 800 });
    const denied = await kernel.execute("house", {
      type: "stage_duel",
      operationId: op(),
      expectedVersion: ws.stateVersion,
      player: "house",
      lives: [probe.lives[0], probe.lives[1]],
      variable: "x or y",
      bet: { pick: "a", chips: 1, because: "again" },
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe("CORRECTION_REQUIRED");
  });

  it("replays the same operation without double counting and rejects stale versions", async () => {
    const kernel = new StingKernel(new MemoryStore());
    const first = await kernel.execute("participant", { type: "start", operationId: "same", expectedVersion: 0 });
    const again = await kernel.execute("participant", { type: "start", operationId: "same", expectedVersion: 0 });
    expect(first.ok && again.ok && again.replayed).toBe(true);
    if (first.ok && again.ok) expect(again.receipt.hash).toBe(first.receipt.hash);
    const stale = await kernel.execute("house", { type: "cast", operationId: op(), expectedVersion: 0, player: "house", lives: [] });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe("STALE_VERSION");
  });

  it("never lets a player tap, kill, crown or accept for the person", async () => {
    const kernel = new StingKernel(new MemoryStore());
    let ws = await run(kernel, "participant", { type: "start", expectedVersion: 0 });
    ws = await houseTurn(kernel, ws);
    const tap = await kernel.execute("house", { type: "pick_life", operationId: op(), expectedVersion: ws.stateVersion, lifeRef: "life-sold", dwellMs: 1 });
    expect(tap.ok).toBe(false);
    if (!tap.ok) expect(tap.code).toBe("PARTICIPANT_ONLY");
    const keep = await kernel.execute("house", { type: "keep_all", operationId: op(), expectedVersion: ws.stateVersion });
    expect(keep.ok).toBe(false);
    if (!keep.ok) expect(keep.code).toBe("PARTICIPANT_ONLY");
  });

  it("denies describing the person before the house has earned it, and denies bringing back a kill", async () => {
    const kernel = new StingKernel(new MemoryStore());
    let ws = await run(kernel, "participant", { type: "start", expectedVersion: 0 });
    ws = await houseTurn(kernel, ws);
    for (const ref of ["life-sold", "life-fixer", "life-stage"]) {
      ws = await run(kernel, "participant", { type: "pick_life", expectedVersion: ws.stateVersion, lifeRef: ref, dwellMs: 1000 });
    }
    const early = await kernel.execute("house", { type: "propose_hypothesis", operationId: op(), expectedVersion: ws.stateVersion, player: "house", kind: "hunger", text: "To be needed.", proofRefs: [] });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.code).toBe("WRONG_PHASE");
    // An unearned player may still guess once duels close, but the line is marked as a draft.
    let room = await playMatch(new StingKernel(new MemoryStore()), { pick: (r) => (r.reactions.length % 2 === 0 ? "a" : "b") });
    const k3 = new StingKernel(new MemoryStore(room));
    room = await houseTurn(k3, room);
    const drafts = room.hypotheses.filter((h) => ["hunger", "mask", "edge"].includes(h.kind));
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.every((h) => h.earned === room.record.earned)).toBe(true);

    ws = await playMatch(new StingKernel(new MemoryStore()));
    const kernel2 = new StingKernel(new MemoryStore(ws));
    ws = await houseTurn(kernel2, ws);
    const target = ws.hypotheses.find((h) => h.status === "proposed")!;
    ws = await run(kernel2, "participant", { type: "kill", expectedVersion: ws.stateVersion, hypothesisRef: target.ref });
    expect(ws.kills.map((k) => k.text)).toContain(target.text);
    const back = await kernel2.execute("house", { type: "propose_hypothesis", operationId: op(), expectedVersion: ws.stateVersion, player: "house", kind: target.kind, text: target.text.toUpperCase(), proofRefs: target.proofRefs });
    expect(back.ok).toBe(false);
    if (!back.ok) expect(back.code).toBe("KILLED");
  });

  it("rejects labels, out-of-bounds lives, two-variable duels and irreversible dares", async () => {
    const kernel = new StingKernel(new MemoryStore());
    let ws = await run(kernel, "participant", { type: "start", expectedVersion: 0 });
    const label = await kernel.execute("house", { type: "cast", operationId: op(), expectedVersion: ws.stateVersion, player: "house", lives: Array.from({ length: 8 }, (_, i) => ({ ref: `l${i}`, line: i === 0 ? "You are an engineer now." : "A quiet desk at dawn.", scene: "desk" as const, axis: "depth_breadth" as const, pole: "a" as const })) });
    expect(label.ok).toBe(false);
    if (!label.ok) expect(label.code).toBe("LIFE_IS_A_LABEL");
    ws = await houseTurn(kernel, ws);
    for (const ref of ["life-sold", "life-fixer", "life-stage"]) {
      ws = await run(kernel, "participant", { type: "pick_life", expectedVersion: ws.stateVersion, lifeRef: ref, dwellMs: 1000 });
    }
    ws = await run(kernel, "house", { type: "propose_hypothesis", expectedVersion: ws.stateVersion, player: "house", kind: "cold_read", text: "Wants mornings." });
    const twoVars = await kernel.execute("house", { type: "stage_duel", operationId: op(), expectedVersion: ws.stateVersion, player: "house", lives: [ws.lives[0], ws.lives[1]], variable: "", bet: { pick: "a", chips: 1, because: "x" } });
    expect(twoVars.ok).toBe(false);
    if (!twoVars.ok) expect(twoVars.code).toBe("DUEL_NOT_ISOLATED");
  });

  it("lets the house strip lives it did not write, so a model-cast match can always finish", async () => {
    const kernel = new StingKernel(new MemoryStore());
    let ws = await run(kernel, "participant", { type: "start", expectedVersion: 0 });
    const axes = ["autonomy_belonging", "depth_breadth", "making_deciding", "visible_hidden", "stability_risk", "people_things", "visible_hidden", "people_things"] as const;
    const lives = axes.map((axis, index) => ({ ref: `spark-${index}`, line: `Scene number ${index} on a Tuesday.`, scene: "desk" as const, axis, pole: index % 2 === 0 ? ("a" as const) : ("b" as const) }));
    ws = await run(kernel, "house", { type: "cast", expectedVersion: ws.stateVersion, player: "house", lives });
    for (const ref of ["spark-0", "spark-3", "spark-5"]) {
      ws = await run(kernel, "participant", { type: "pick_life", expectedVersion: ws.stateVersion, lifeRef: ref, dwellMs: 1000 });
    }
    for (let i = 0; i < 12 && ws.phase === "duel"; i += 1) {
      ws = await houseTurn(kernel, ws);
      const probe = openProbe(ws);
      if (!probe) break;
      expect(probe.lives[0].axis).toBe(probe.lives[1].axis);
      ws = await run(kernel, "participant", { type: "react", expectedVersion: ws.stateVersion, probeRef: probe.ref, pick: i === 1 ? "a" : "b", dwellMs: 900 });
    }
    ws = await houseTurn(kernel, ws);
    expect(ws.phase).toBe("verdict");
    expect(answeredDuelsCount(ws)).toBeGreaterThanOrEqual(5);
  });

  it("chains receipts so an edited history is detectable", async () => {
    const kernel = new StingKernel(new MemoryStore());
    const ws = await playMatch(kernel);
    let prev = "genesis";
    for (const receipt of ws.receipts) {
      expect(receipt.prev).toBe(prev);
      const expected = await chainHash({ prev, seq: receipt.seq, operationId: receipt.operationId, command: receipt.command, stateVersion: receipt.stateVersion, summary: receipt.summary });
      expect(receipt.hash).toBe(expected);
      prev = receipt.hash;
    }
    expect(ws.receipts.length).toBeGreaterThan(10);
  });
});

describe("STING kernel: the captain's choices", () => {
  it("corrects a miss even when the model named the variable without an 'or'", async () => {
    const { houseCorrection } = await import("./house");
    const kernel = new StingKernel(new MemoryStore());
    let ws = await run(kernel, "participant", { type: "start", expectedVersion: 0 });
    ws = await houseTurn(kernel, ws);
    for (const ref of ["life-sold", "life-fixer", "life-stage"]) ws = await run(kernel, "participant", { type: "pick_life", expectedVersion: ws.stateVersion, lifeRef: ref, dwellMs: 1000 });
    ws = await run(kernel, "spark", { type: "propose_hypothesis", expectedVersion: ws.stateVersion, player: "spark", kind: "cold_read", text: "Wants the quiet." });
    ws = await run(kernel, "spark", { type: "stage_duel", expectedVersion: ws.stateVersion, player: "spark", lives: [{ ref: "d-a", line: "Tuning one engine, alone.", scene: "workshop", axis: "people_things", pole: "a" }, { ref: "d-b", line: "Tuning engines with six kids.", scene: "workshop", axis: "people_things", pole: "b" }], variable: "with people", bet: { pick: "a", chips: 1, because: "quiet" }, testsLifeRef: "life-fixer" });
    const probe = openProbe(ws)!;
    ws = await run(kernel, "participant", { type: "react", expectedVersion: ws.stateVersion, probeRef: probe.ref, pick: "b", dwellMs: 700 });
    const fix = houseCorrection(ws, ws.reactions.at(-1)!);
    expect(fix.correction).toContain("I misread you");
    expect(fix.correction).toContain("Tuning engines with six kids");
  });

  it("offers duel, question and close only when the room allows each, and maps a turn onto the right command", async () => {
    const { allowedTurnMoves, commandFromOutput } = await import("./player");
    const kernel = new StingKernel(new MemoryStore());
    let ws = await run(kernel, "participant", { type: "start", expectedVersion: 0 });
    ws = await houseTurn(kernel, ws);
    for (const ref of ["life-sold", "life-fixer", "life-stage"]) ws = await run(kernel, "participant", { type: "pick_life", expectedVersion: ws.stateVersion, lifeRef: ref, dwellMs: 1000 });
    ws = await houseTurn(kernel, ws);
    // A duel is open: nothing to choose.
    expect(allowedTurnMoves(ws)).toEqual([]);
    const probe = openProbe(ws)!;
    const against = probe.bet!.pick === "a" ? "b" : "a";
    ws = await run(kernel, "participant", { type: "react", expectedVersion: ws.stateVersion, probeRef: probe.ref, pick: against, dwellMs: 800 });
    // A miss without a correction: nothing to choose either.
    expect(allowedTurnMoves(ws)).toEqual([]);
    const missed = ws.reactions.at(-1)!;
    ws = await run(kernel, "house", { type: "propose_hypothesis", expectedVersion: ws.stateVersion, player: "house", kind: "revision", text: "You want the quiet.", revises: missed.ref, correction: "I misread you." });
    expect(allowedTurnMoves(ws)).toEqual(["duel", "question"]);
    const close = commandFromOutput(ws, "turn", { move: "close", aside: "Enough. I know." }, "spark");
    expect(close[0].type).toBe("close_duels");
    const denied = await kernel.execute("spark", { ...close[0], operationId: op() } as Command);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe("NOT_ENOUGH_DUELS");
    const question = commandFromOutput(ws, "turn", { move: "question", text: "Free Saturday. What do you do?", options: ["Alone", "Call someone", "Wait"], aside: "Your taps disagree. One question." }, "spark");
    expect(question[0].type).toBe("ask_once");
    ws = await run(kernel, "spark", question[0]);
    expect(ws.voice.at(-1)?.text).toBe("Your taps disagree. One question.");
    expect(ws.record.player).toBe("house");
  });
});
