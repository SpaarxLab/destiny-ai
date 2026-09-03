import { describe, expect, it } from "vitest";
import { EARN_CHIPS, START_CHIPS, freshWorkspace, openProbe, type Workspace, openQuestion } from "./domain";
import { houseMove } from "./driver";
import { chainHash, verifyCommitment } from "./hash";
import { StingKernel, participantView, type Command, type PendingMove } from "./kernel";
import { MemoryStore, StoreError, type StingStore } from "./store";

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
  it("plays a whole match without a model provider and ends on a card", async () => {
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
    expect(ws.brief?.text).toMatch(/^FIELD BRIEF.*\nYOUR SIGNAL\nI want /);
    expect(ws.brief?.text).toContain("THE NEXT TEST");
    expect(ws.brief?.text).toContain("HOW TO HELP ME");
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
    const changedPayload = await kernel.execute("participant", { type: "start", timing: false, operationId: "same", expectedVersion: 0 });
    expect(changedPayload.ok).toBe(false);
    if (!changedPayload.ok) expect(changedPayload.code).toBe("IDEMPOTENCY_CONFLICT");
    const changedActor = await kernel.execute("house", { type: "start", operationId: "same", expectedVersion: 0 });
    expect(changedActor.ok).toBe(false);
    if (!changedActor.ok) expect(changedActor.code).toBe("IDEMPOTENCY_CONFLICT");
    const stale = await kernel.execute("house", { type: "cast", operationId: op(), expectedVersion: 0, player: "house", lives: [] });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe("STALE_VERSION");
  });

  it("reports a write-lock race as STALE_VERSION so a stale tab can refresh", async () => {
    let room = freshWorkspace("2026-09-03T12:00:00.000Z");
    const store: StingStore = {
      load: () => structuredClone(room),
      async save() {
        room = { ...room, phase: "cast", stateVersion: 1 };
        throw new StoreError("STALE_WRITE", "Another tab won the write lock.", room.stateVersion);
      },
      async clear() {
        room = freshWorkspace("2026-09-03T12:00:00.000Z");
      },
    };
    const result = await new StingKernel(store).execute("participant", { type: "start", operationId: "tab-race", expectedVersion: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("STALE_VERSION");
      expect(result.stateVersion).toBe(1);
    }
  });

  it("leaves no receipt, activity or state behind when authority is revoked during a write", async () => {
    for (const allowedChecks of [1, 2]) {
      const store = new MemoryStore();
      const kernel = new StingKernel(store);
      let checks = 0;
      const result = await kernel.execute(
        "participant",
        { type: "start", operationId: `cancel-after-${allowedChecks}`, expectedVersion: 0 },
        () => checks++ < allowedChecks,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("CANCELLED");
      const room = store.load();
      expect(room.phase).toBe("door");
      expect(room.stateVersion).toBe(0);
      expect(room.receipts).toEqual([]);
      expect(room.activity).toEqual([]);
    }
  });

  it("denies duel and question writes before the sealed cold read", async () => {
    const kernel = new StingKernel(new MemoryStore());
    let ws = await run(kernel, "participant", { type: "start", expectedVersion: 0 });
    ws = await houseTurn(kernel, ws);
    for (const ref of ["life-sold", "life-fixer", "life-stage"]) {
      ws = await run(kernel, "participant", { type: "pick_life", expectedVersion: ws.stateVersion, lifeRef: ref, dwellMs: 1000 });
    }
    const target = ws.lives.find((life) => life.ref === "life-sold")!;
    const duel = await kernel.execute("house", {
      type: "stage_duel",
      operationId: op(),
      expectedVersion: ws.stateVersion,
      player: "house",
      testsLifeRef: target.ref,
      lives: [
        { ref: "cold-a", line: "A morning alone in the workshop.", scene: "workshop", axis: target.axis, pole: "a" },
        { ref: "cold-b", line: "A morning shared in the workshop.", scene: "workshop", axis: target.axis, pole: "b" },
      ],
      variable: "alone or shared",
      bet: { pick: "a", chips: 1, because: "The first tap leaned quiet." },
    });
    expect(duel.ok).toBe(false);
    if (!duel.ok) expect(duel.code).toBe("COLD_READ_REQUIRED");
    const question = await kernel.execute("house", {
      type: "ask_once",
      operationId: op(),
      expectedVersion: ws.stateVersion,
      player: "house",
      text: "Which morning would you keep?",
      options: ["Alone", "Shared", "Neither"],
    });
    expect(question.ok).toBe(false);
    if (!question.ok) expect(question.code).toBe("COLD_READ_REQUIRED");
  });

  it("binds a duel to the axis of the selected life it claims to test", async () => {
    const kernel = new StingKernel(new MemoryStore());
    let ws = await run(kernel, "participant", { type: "start", expectedVersion: 0 });
    ws = await houseTurn(kernel, ws);
    for (const ref of ["life-sold", "life-fixer", "life-stage"]) {
      ws = await run(kernel, "participant", { type: "pick_life", expectedVersion: ws.stateVersion, lifeRef: ref, dwellMs: 1000 });
    }
    ws = await run(kernel, "house", {
      type: "propose_hypothesis",
      expectedVersion: ws.stateVersion,
      player: "house",
      kind: "cold_read",
      text: "Wants the quiet and the distance.",
    });

    const generated = houseMove(ws);
    expect(generated?.type).toBe("stage_duel");
    if (!generated || generated.type !== "stage_duel") throw new Error("Expected the house to stage a duel.");
    const generatedTarget = ws.lives.find((life) => life.ref === generated.testsLifeRef)!;
    expect(generated.lives[0].axis).toBe(generatedTarget.axis);

    const target = ws.lives.find((life) => life.ref === "life-sold")!;
    const wrongAxis = target.axis === "autonomy_belonging" ? "visible_hidden" : "autonomy_belonging";
    const before = kernel.load();
    const result = await kernel.execute("house", {
      type: "stage_duel",
      operationId: op(),
      expectedVersion: ws.stateVersion,
      player: "house",
      testsLifeRef: target.ref,
      lives: [
        { ref: "wrong-axis-a", line: "Known and watched all day.", scene: "stage", axis: wrongAxis, pole: "a" },
        { ref: "wrong-axis-b", line: "Unknown and left alone.", scene: "night", axis: wrongAxis, pole: "b" },
      ],
      variable: "seen or quiet",
      bet: { pick: "a", chips: 1, because: "The selected life looked visible." },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("DUEL_NOT_ISOLATED");
    expect(kernel.load()).toEqual(before);
  });

  it("persists the participant's chosen in-page owner when the visiting agent yields", async () => {
    const kernel = new StingKernel(new MemoryStore());
    let ws = await run(kernel, "participant", { type: "start", expectedVersion: 0 });
    ws = await run(kernel, "participant", { type: "yield_agent", target: "spark", expectedVersion: ws.stateVersion });
    expect(ws.record.externalAllowed).toBe(false);
    expect(ws.record.player).toBe("spark");
    expect(ws.record.via).toBeUndefined();
    expect(kernel.load().record.player).toBe("spark");

    const visitingWrite = await kernel.execute("chatgpt", {
      type: "identify",
      operationId: op(),
      expectedVersion: ws.stateVersion,
      player: "chatgpt",
      via: "A cached visiting client",
    });
    expect(visitingWrite.ok).toBe(false);
    if (!visitingWrite.ok) expect(visitingWrite.code).toBe("AGENT_ONLY");

    ws = await run(kernel, "spark", {
      type: "identify",
      expectedVersion: ws.stateVersion,
      player: "spark",
      via: "The in-page player",
    });
    expect(ws.record.player).toBe("spark");
    expect(ws.record.via).toBe("The in-page player");
  });

  it("cannot seal a prediction at the exact instant the outcome becomes knowable", async () => {
    const dueAt = "2026-09-10T12:00:00.000Z";
    const ws = freshWorkspace("2026-09-03T12:00:00.000Z");
    ws.phase = "card";
    ws.stateVersion = 4;
    ws.record.chips = 20;
    ws.chosenPoster = "poster-1";
    ws.dare = {
      ref: "dare-1",
      lifeRef: "poster-1",
      action: "Cook for two people on Thursday.",
      doneLooksLike: "Two plates and one photo.",
      days: 7,
      hours: 2,
      money: 0,
      currency: "INR",
      status: "accepted",
      acceptedAt: 3,
      dueAt,
    };
    ws.brief = { text: "FIELD BRIEF\nReady for the week.", player: "house", at: 4 };
    const store = new MemoryStore(ws);
    const kernel = new StingKernel(store, () => new Date(dueAt));
    const result = await kernel.execute("chatgpt", {
      type: "seal_letter",
      operationId: op(),
      expectedVersion: ws.stateVersion,
      player: "chatgpt",
      willDo: true,
      feeling: "lighter",
      note: "The week will decide whether the bet was right.",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WRONG_PHASE");
    expect(store.load().letter).toBeUndefined();
    expect(store.load().receipts).toEqual([]);
  });

  it("keeps an open paid question in front of every verdict decision", async () => {
    const ws = freshWorkspace("2026-09-03T12:00:00.000Z");
    ws.phase = "verdict";
    ws.stateVersion = 6;
    ws.hypotheses.push({
      ref: "hyp-hunger",
      kind: "hunger",
      text: "To make useful things beside people you trust.",
      proofRefs: [],
      status: "proposed",
      earned: true,
      player: "house",
      at: 5,
    });
    ws.questions.push({
      ref: "q-open",
      player: "house",
      text: "Which part would you miss first?",
      options: ["Making", "The people", "The quiet"],
      chipsCost: 1,
      askedAt: 6,
    });
    const store = new MemoryStore(ws);
    const kernel = new StingKernel(store);

    const kill = await kernel.execute("participant", {
      type: "kill",
      operationId: op(),
      expectedVersion: ws.stateVersion,
      hypothesisRef: "hyp-hunger",
    });
    expect(kill.ok).toBe(false);
    if (!kill.ok) expect(kill.code).toBe("QUESTION_OPEN");

    const keep = await kernel.execute("participant", {
      type: "keep_all",
      operationId: op(),
      expectedVersion: ws.stateVersion,
    });
    expect(keep.ok).toBe(false);
    if (!keep.ok) expect(keep.code).toBe("QUESTION_OPEN");
    expect(store.load().phase).toBe("verdict");
    expect(store.load().hypotheses[0].status).toBe("proposed");

    const answered = await kernel.execute("participant", {
      type: "answer_question",
      operationId: op(),
      expectedVersion: ws.stateVersion,
      questionRef: "q-open",
      choice: 1,
    });
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    const continued = await kernel.execute("participant", {
      type: "keep_all",
      operationId: op(),
      expectedVersion: answered.workspace.stateVersion,
    });
    expect(continued.ok).toBe(true);
    if (continued.ok) expect(continued.workspace.phase).toBe("lives");
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

  it("rejects duplicate and near-duplicate live verdict lines", async () => {
    const ws = freshWorkspace("2026-09-03T12:00:00.000Z");
    ws.phase = "verdict";
    ws.stateVersion = 10;
    ws.record.chips = 20;
    ws.record.earned = true;
    ws.reactions = [
      { ref: "r1", probeRef: "p1", pick: "a", pickedLifeRef: "l1", dwellMs: 3000, betOutcome: "hit", chipsMoved: 2, corrected: false, at: 1 },
      { ref: "r2", probeRef: "p2", pick: "b", pickedLifeRef: "l2", dwellMs: 900, betOutcome: "miss", chipsMoved: -1, corrected: true, at: 2 },
      { ref: "r3", probeRef: "p3", pick: "a", pickedLifeRef: "l3", dwellMs: 1200, betOutcome: "hit", chipsMoved: 2, corrected: false, at: 3 },
    ];
    const kernel = new StingKernel(new MemoryStore(ws));
    const first = await kernel.execute("house", { type: "propose_hypothesis", operationId: "first-hunger", expectedVersion: 10, player: "house", kind: "hunger", text: "You want to build useful things beside trusted people.", proofRefs: ["r1", "r2", "r3"] });
    expect(first.ok).toBe(true);
    const duplicate = await kernel.execute("house", { type: "propose_hypothesis", operationId: "duplicate-hunger", expectedVersion: 11, player: "house", kind: "hunger", text: "YOU want to build useful things beside trusted people!", proofRefs: ["r1", "r2", "r3"] });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.code).toBe("TRAY_FULL");
  });

  it("returns a rejected dare to the life choice instead of repeating it", async () => {
    const ws = freshWorkspace("2026-09-03T12:00:00.000Z");
    ws.phase = "dare";
    ws.stateVersion = 4;
    ws.posters = [{ ref: "poster-one", line: "Build one useful thing this week.", scene: "workshop", axis: "making_deciding", pole: "a", week: ["Start it.", "Finish it.", "Show it."], tradeoff: "Other work waits.", question: "Will making clarify the choice?" }];
    ws.chosenPoster = "poster-one";
    ws.dare = { ref: "dare-one", lifeRef: "poster-one", action: "Build one useful thing.", doneLooksLike: "One finished object.", days: 7, hours: 2, money: 0, currency: "INR", status: "proposed" };
    const result = await new StingKernel(new MemoryStore(ws)).execute("participant", { type: "reject_dare", operationId: "reject-dare", expectedVersion: 4 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.workspace.phase).toBe("lives");
      expect(result.workspace.chosenPoster).toBeUndefined();
      expect(result.workspace.dare).toBeUndefined();
    }
  });

  it("hands later creative moves to the house while a player is on probation", async () => {
    const assertHouseFallback = async (ws: Workspace, expectedType: "stage_fight" | "stage_lives" | "propose_dare" | "seal_letter") => {
      const move = houseMove(ws);
      expect(move?.type).toBe(expectedType);
      if (!move) throw new Error(`Expected ${expectedType} fallback.`);
      const store = new MemoryStore(ws);
      const kernel = new StingKernel(store, () => new Date("2026-09-03T12:00:00Z"));
      const visiting = await kernel.execute("chatgpt", { ...move, player: "chatgpt", operationId: op() } as Command);
      expect(visiting.ok).toBe(false);
      if (!visiting.ok) expect(visiting.code).toBe("NOT_EARNED");
      expect(store.load()).toEqual(ws);

      const fallback = await kernel.execute("house", { ...move, player: "house", operationId: op() } as Command);
      expect(fallback.ok).toBe(true);
    };

    const base = () => {
      const ws = freshWorkspace("2026-09-03T12:00:00Z");
      ws.record.chips = 5;
      ws.record.player = "chatgpt";
      ws.record.players = ["chatgpt"];
      return ws;
    };

    const fight = base();
    fight.phase = "fight";
    fight.hypotheses.push(
      { ref: "hunger-one", kind: "hunger", text: "To make useful things.", proofRefs: [], status: "kept", earned: false, player: "chatgpt", at: 0 },
      { ref: "hunger-two", kind: "hunger", text: "To stay close to people.", proofRefs: [], status: "kept", earned: false, player: "chatgpt", at: 0 },
    );
    await assertHouseFallback(fight, "stage_fight");

    const lives = base();
    lives.phase = "lives";
    const livesMove = houseMove(lives);
    expect(livesMove?.type).toBe("stage_lives");
    await assertHouseFallback(lives, "stage_lives");

    const dare = base();
    dare.phase = "dare";
    if (!livesMove || livesMove.type !== "stage_lives") throw new Error("Expected house posters.");
    dare.posters = livesMove.posters;
    dare.chosenPoster = dare.posters[0].ref;
    await assertHouseFallback(dare, "propose_dare");

    const card = base();
    card.phase = "card";
    card.posters = livesMove.posters;
    card.chosenPoster = card.posters[0].ref;
    card.dare = { ref: "dare-card", lifeRef: card.chosenPoster, action: "Make one small useful thing.", doneLooksLike: "One finished object.", days: 7, hours: 1, money: 0, currency: "INR", status: "accepted", acceptedAt: 0, dueAt: "2026-09-10T12:00:00Z" };
    card.brief = { text: "FIELD BRIEF\nReady.", player: "house", at: 0 };
    await assertHouseFallback(card, "seal_letter");
  });

  it("does not re-propose a killed house hunger when no live candidate remains", () => {
    const ws = freshWorkspace("2026-09-03T12:00:00Z");
    ws.phase = "verdict";
    const first = houseMove(ws);
    expect(first?.type).toBe("propose_hypothesis");
    if (!first || first.type !== "propose_hypothesis") throw new Error("Expected a house hunger.");
    ws.kills.push({ hypothesisRef: "killed-house-hunger", text: first.text.toUpperCase(), at: 0 });
    expect(houseMove(ws)).toBeNull();
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
      const expected = await chainHash({ prev, seq: receipt.seq, operationId: receipt.operationId, command: receipt.command, stateVersion: receipt.stateVersion, summary: receipt.summary, requestHash: receipt.requestHash });
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
    const beforeRevision = kernel.load();
    for (const correction of ["Oops", "I misread you.", "  I   MISREAD you. Oops  "]) {
      const denied = await kernel.execute("house", { type: "propose_hypothesis", operationId: op(), expectedVersion: ws.stateVersion, player: "house", kind: "revision", text: "Oops", revises: missed.ref, correction });
      expect(denied.ok).toBe(false);
      if (!denied.ok) expect(denied.code).toBe("CORRECTION_REQUIRED");
      expect(kernel.load()).toEqual(beforeRevision);
      expect(allowedTurnMoves(kernel.load())).toEqual([]);
    }
    ws = await run(kernel, "house", { type: "propose_hypothesis", expectedVersion: ws.stateVersion, player: "house", kind: "revision", text: "You want the quiet.", revises: missed.ref, correction: "  i   MISREAD you. I mistook quiet for distance.  " });
    expect(ws.hypotheses.at(-1)?.correction).toBe("i MISREAD you. I mistook quiet for distance.");
    expect(allowedTurnMoves(ws)).toEqual(["duel", "question"]);
    const question = commandFromOutput(ws, "turn", { move: "question", text: "Free Saturday. What do you do?", options: ["Alone", "Call someone", "Wait"], aside: "Your taps disagree. One question." }, "spark");
    expect(question[0].type).toBe("ask_once");
    ws = await run(kernel, "spark", question[0]);
    expect(ws.voice.at(-1)?.text).toBe("Your taps disagree. One question.");
    expect(ws.record.player).toBe("house");
  });
});
