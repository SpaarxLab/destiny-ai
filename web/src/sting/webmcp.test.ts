import { afterEach, describe, expect, it, vi } from "vitest";
import { freshWorkspace, openProbe, type Workspace } from "./domain";
import { houseMove } from "./driver";
import { StingKernel, type Command, type PendingMove } from "./kernel";
import { requiredMove } from "./player";
import { MemoryStore, type StingStore } from "./store";
import { StingWebMcp, canExternalAgentMove, catalogueKey, createStingTools, inspectRoom, toolsForRoom } from "./webmcp";
import type { WebMcpModelContext, WebMcpToolDefinition } from "../webmcp/runtime";

let counter = 0;
const op = () => `webmcp-op-${++counter}`;

function fakeContext() {
  const registered: { tool: WebMcpToolDefinition; signal: AbortSignal }[] = [];
  const context: WebMcpModelContext = {
    async registerTool(tool, options) {
      registered.push({ tool, signal: options.signal });
    },
  };
  const live = () => registered.filter((entry) => !entry.signal.aborted).map((entry) => entry.tool);
  const call = (name: string, input: unknown) => {
    const tool = live().find((entry) => entry.name === name);
    if (!tool) throw new Error(`${name} is not registered right now (${live().map((t) => t.name).join(", ")})`);
    return tool.execute(input) as Promise<Record<string, unknown>>;
  };
  return { context, live, call };
}

async function setup(clock: () => Date = () => new Date(), store: StingStore = new MemoryStore()) {
  const kernel = new StingKernel(store, clock);
  let latest: Workspace = kernel.load();
  const fake = fakeContext();
  // Mirrors the page: every change the tools make re-syncs the catalogue.
  const bridge: StingWebMcp = new StingWebMcp({ kernel, onChanged: (ws) => { latest = ws; void bridge.sync(ws); }, operationId: op, passport: () => "Test client 1" }, fake.context);
  const person = async (command: PendingMove) => {
    const result = await kernel.execute("participant", { ...command, operationId: op() } as Command);
    if (!result.ok) throw new Error(`${command.type}: ${result.code}`);
    latest = result.workspace;
    await bridge.sync(latest);
    return latest;
  };
  await bridge.sync(latest);
  return { kernel, store, fake, bridge, person, latest: () => latest };
}

afterEach(() => {
  vi.useRealTimers();
});

const eightLives = Array.from({ length: 8 }, (_, index) => ({
  line: `Scene ${index + 1} on a Tuesday, quietly.`,
  scene: "desk",
  axis: (["autonomy_belonging", "depth_breadth", "making_deciding", "visible_hidden", "stability_risk", "people_things", "visible_hidden", "people_things"] as const)[index],
  pole: index % 2 === 0 ? "a" : "b",
}));

describe("STING WebMCP catalogue", () => {
  it("registers only inspect_room at the door and opens stage_cast after Play, firing a re-registration", async () => {
    const { fake, person, bridge } = await setup();
    const changes: string[][] = [];
    bridge.onCatalogue = (change) => changes.push(change.added);
    expect(fake.live().map((tool) => tool.name)).toEqual(["inspect_room"]);
    await person({ type: "start", expectedVersion: 0 });
    expect(fake.live().map((tool) => tool.name)).toEqual(["inspect_room", "stage_cast"]);
    expect(changes).toEqual([["stage_cast"]]);
    for (const tool of fake.live()) {
      expect(tool.description.length).toBeLessThanOrEqual(500);
      expect(tool.title).toBeTruthy();
    }
  });

  it("replays generated-ref tools from the caller's original version without an idempotency conflict", async () => {
    const replay = async (room: Workspace, name: string, input: Record<string, unknown>) => {
      const store = new MemoryStore(room);
      const kernel = new StingKernel(store, () => new Date("2026-09-03T12:00:00Z"));
      const tool = createStingTools(room, { kernel, onChanged: () => undefined, operationId: op }).find((candidate) => candidate.name === name);
      expect(tool, `${name} should be registered`).toBeDefined();
      const first = await tool!.execute(input) as { ok?: boolean; replayed?: boolean; receipt?: { hash: string } };
      const again = await tool!.execute(input) as { ok?: boolean; replayed?: boolean; receipt?: { hash: string }; denied?: { code: string } };
      expect(first.ok).toBe(true);
      expect(again.ok).toBe(true);
      expect(again.replayed).toBe(true);
      expect(again.receipt?.hash).toBe(first.receipt?.hash);
      expect(store.load().stateVersion).toBe((input.expectedVersion as number) + 1);
    };

    const cast = freshWorkspace("2026-09-03T12:00:00.000Z");
    cast.phase = "cast";
    cast.stateVersion = 4;
    cast.record.player = "chatgpt";
    cast.record.players = ["chatgpt"];
    await replay(cast, "stage_cast", { operationId: "replay-cast", expectedVersion: 4, lives: eightLives });

    const duel = freshWorkspace("2026-09-03T12:00:00.000Z");
    duel.phase = "duel";
    duel.stateVersion = 8;
    duel.record.player = "chatgpt";
    duel.record.players = ["chatgpt"];
    duel.lives = [{ ref: "life-target", line: "Builds beside a trusted crew.", scene: "workshop", axis: "people_things", pole: "b" }];
    duel.picks.stings = ["life-target"];
    duel.hypotheses.push({ ref: "cold", kind: "cold_read", text: "You want to make useful things.", proofRefs: [], status: "sealed", earned: true, player: "chatgpt", at: 7 });
    await replay(duel, "stage_duel", {
      operationId: "replay-duel",
      expectedVersion: 8,
      testsLifeRef: "life-target",
      axis: "people_things",
      variable: "alone or together",
      a: { line: "Builds the useful thing alone.", scene: "workshop" },
      b: { line: "Builds it beside trusted people.", scene: "workshop" },
      bet: { pick: "b", chips: 2, because: "The selected life already chose a crew." },
    });

    const lives = freshWorkspace("2026-09-03T12:00:00.000Z");
    lives.phase = "lives";
    lives.stateVersion = 12;
    lives.record.player = "chatgpt";
    lives.record.players = ["chatgpt"];
    lives.record.chips = 6;
    await replay(lives, "stage_route_auditions", {
      operationId: "replay-lives",
      expectedVersion: 12,
      posters: [
        { line: "Builds one useful thing before breakfast.", scene: "workshop", axis: "depth_breadth", pole: "a", week: ["Sketch it Monday.", "Make it Wednesday.", "Show it Friday."], tradeoff: "Other ideas wait.", question: "Does depth still feel alive?" },
        { line: "Hosts a table where strangers connect.", scene: "kitchen", axis: "autonomy_belonging", pole: "b", week: ["Invite three people.", "Cook one meal.", "Notice who returns."], tradeoff: "Solitude gets less room.", question: "Does belonging create energy?" },
        { line: "Ships the strange demo in public.", scene: "stage", axis: "visible_hidden", pole: "a", week: ["Name the claim.", "Record the proof.", "Publish the result."], tradeoff: "Criticism becomes possible.", question: "Does visibility sharpen the craft?" },
      ],
    });
  });

  it("replays the first bridge write after passport stamping with the same semantic command", async () => {
    const room = freshWorkspace("2026-09-03T12:00:00.000Z");
    room.phase = "cast";
    const store = new MemoryStore(room);
    const kernel = new StingKernel(store, () => new Date("2026-09-03T12:00:00Z"));
    const fake = fakeContext();
    const bridge = new StingWebMcp({
      kernel,
      onChanged: () => undefined,
      operationId: () => "passport-stamp",
      passport: () => "Chrome test client",
    }, fake.context);
    await bridge.sync(room);
    const stageCast = fake.live().find((tool) => tool.name === "stage_cast");
    expect(stageCast).toBeDefined();
    const input = { operationId: "bridge-replay-cast", expectedVersion: 0, lives: eightLives };
    const first = await stageCast!.execute(input) as { ok?: boolean; receipt?: { hash: string } };
    const again = await stageCast!.execute(input) as { ok?: boolean; replayed?: boolean; receipt?: { hash: string }; denied?: { code: string } };
    expect(first.ok).toBe(true);
    expect(again.ok).toBe(true);
    expect(again.replayed).toBe(true);
    expect(again.receipt?.hash).toBe(first.receipt?.hash);
    expect(store.load().stateVersion).toBe(2);
    expect(store.load().lives[0].ref).toBe("life-2-1");
    bridge.stop();
  });

  it("has no tool that taps, kills, crowns or accepts; only the person moves the room forward", async () => {
    const { fake, person } = await setup();
    await person({ type: "start", expectedVersion: 0 });
    const names = fake.live().map((tool) => tool.name);
    for (const forbidden of ["pick_life", "react", "kill", "crown", "choose_poster", "accept_dare", "keep_all", "answer_question", "add_rule", "open_letter"]) expect(names).not.toContain(forbidden);
  });

  it("advertises a crown or life choice only after that human decision is actually staged", async () => {
    const ws = new MemoryStore().load();
    ws.phase = "fight";
    expect(inspectRoom(ws).openHumanDecision).toBeNull();

    ws.fight = { refs: ["hunger-a", "hunger-b"], status: "open" };
    expect(inspectRoom(ws).openHumanDecision).toBe("crown a hunger");

    ws.phase = "lives";
    ws.fight.status = "crowned";
    expect(inspectRoom(ws).openHumanDecision).toBeNull();

    ws.posters = [{
      ref: "poster-a",
      line: "One craft, every morning, visibly better.",
      scene: "workshop",
      axis: "depth_breadth",
      pole: "a",
      week: ["Monday: begin.", "Wednesday: continue.", "Friday: show it."],
      tradeoff: "The other ideas wait.",
      question: "Will depth still feel alive?",
    }];
    expect(inspectRoom(ws).openHumanDecision).toBe("choose a life");
  });

  it("reports only completed handoff stages and waits to offer keep-or-kill until the verdict is ready", () => {
    const handoff = (room: Workspace) => (inspectRoom(room, "handoff") as { handoff: { youAreNew: string } }).handoff.youAreNew;
    const ws = new MemoryStore().load();
    expect(handoff(ws)).toContain("has not started; nothing is settled");

    ws.phase = "cast";
    expect(handoff(ws)).toContain("cast, picks, duels and verdict are not settled");

    ws.phase = "duel";
    expect(handoff(ws)).toContain("duel run is still in progress");

    ws.phase = "verdict";
    expect(requiredMove(ws)).toBe("verdict");
    expect(inspectRoom(ws).openHumanDecision).toBeNull();
    expect(handoff(ws)).toContain("verdict is still being written");

    ws.hypotheses.push(
      { ref: "handoff-hunger", kind: "hunger", text: "To make useful things.", proofRefs: [], status: "proposed", earned: false, player: "chatgpt", at: 0 },
      { ref: "handoff-edge", kind: "edge", text: "You keep making through uncertainty.", proofRefs: [], status: "proposed", earned: false, player: "chatgpt", at: 0 },
    );
    expect(requiredMove(ws)).toBeNull();
    expect(inspectRoom(ws).openHumanDecision).toBe("keep or kill the lines");
    expect(handoff(ws)).toContain("waits for the person to keep or kill");
  });

  it("casts through stage_cast, hides the sealed bet from inspect_room until the tap, then reveals it with the commitment", async () => {
    const { fake, person, latest, bridge } = await setup();
    await person({ type: "start", expectedVersion: 0 });
    const cast = await fake.call("stage_cast", { operationId: op(), expectedVersion: latest().stateVersion, lives: eightLives });
    expect(cast.ok).toBe(true);
    expect(cast.status).toBe("awaiting_participant");
    // The first write stamped the client on the record as its own receipt, and moved the call's version along with it.
    expect(latest().record.via).toBe("Test client 1");
    expect(latest().receipts.map((receipt) => receipt.command)).toContain("identify");
    const lives = latest().lives;
    expect(lives).toHaveLength(8);
    for (const ref of [lives[0].ref, lives[3].ref, lives[5].ref]) await person({ type: "pick_life", expectedVersion: latest().stateVersion, lifeRef: ref, dwellMs: 900 });
    expect(latest().phase).toBe("duel");

    const cold = await fake.call("propose_hypothesis", { operationId: op(), expectedVersion: latest().stateVersion, kind: "cold_read", text: "Wants to be left alone and missed." });
    expect(cold.ok).toBe(true);
    await bridge.sync(latest());
    await person({ type: "unpick_life", expectedVersion: latest().stateVersion, lifeRef: "nope" }).catch(() => undefined);

    const duel = await fake.call("stage_duel", {
      operationId: op(),
      expectedVersion: latest().stateVersion,
      testsLifeRef: lives[0].ref,
      axis: "autonomy_belonging",
      variable: "alone or reachable",
      a: { line: "Yours alone. Nobody to call.", scene: "beach" },
      b: { line: "Shared. Three people can call you.", scene: "office" },
      bet: { pick: "b", chips: 2, because: "You tapped the quiet one slowly." },
    });
    expect(duel.ok).toBe(true);
    expect(typeof duel.commitment).toBe("string");
    const room = (await fake.call("inspect_room", {})) as ReturnType<typeof inspectRoom>;
    const openDecision = room.openHumanDecision as { commitment?: string; probeRef: string };
    expect(openDecision.commitment).toHaveLength(4);
    expect(JSON.stringify(room)).not.toContain("You tapped the quiet one slowly.");
    const cold2 = room.hypotheses.find((item) => item.kind === "cold_read")!;
    expect(cold2.text).toBe("");

    const probe = openProbe(latest())!;
    await person({ type: "react", expectedVersion: latest().stateVersion, probeRef: probe.ref, pick: "a", dwellMs: 700 });
    const after = (await fake.call("inspect_room", {})) as ReturnType<typeof inspectRoom>;
    expect(after.duels[0].bet).toEqual({ pick: "b", chips: 2, because: "You tapped the quiet one slowly." });
    expect(after.duels[0].outcome).toBe("miss");
    expect(after.record.chips).toBe(10);

    // A miss removes stage_duel from the catalogue itself until a revision lands; the kernel denies it too.
    expect(fake.live().map((tool) => tool.name)).not.toContain("stage_duel");
    expect(() => fake.call("stage_duel", { operationId: op(), expectedVersion: latest().stateVersion, testsLifeRef: lives[3].ref, axis: "visible_hidden", variable: "seen or quiet", a: { line: "Known.", scene: "stage" }, b: { line: "Unknown.", scene: "night" }, bet: { pick: "a", chips: 1, because: "guess" } })).toThrow(/not registered/);
    const revision = await fake.call("propose_hypothesis", { operationId: op(), expectedVersion: latest().stateVersion, kind: "revision", text: "You want the quiet more than the company.", revises: after.duels[0].reactionRef, correction: "I misread you: the quiet won." });
    expect(revision.ok).toBe(true);
    await bridge.sync(latest());
    expect(fake.live().map((tool) => tool.name)).toContain("stage_duel");
  });

  it("prices a question at one chip, waits for the answer, and refuses a second question", async () => {
    const { fake, person, latest, bridge } = await setup();
    await person({ type: "start", expectedVersion: 0 });
    await fake.call("stage_cast", { operationId: op(), expectedVersion: latest().stateVersion, lives: eightLives });
    const lives = latest().lives;
    for (const ref of [lives[0].ref, lives[3].ref, lives[5].ref]) await person({ type: "pick_life", expectedVersion: latest().stateVersion, lifeRef: ref, dwellMs: 900 });
    expect(fake.live().map((tool) => tool.name)).not.toContain("ask_once");
    expect(fake.live().map((tool) => tool.name)).not.toContain("stage_duel");
    const beforeColdRead = (await fake.call("inspect_room", {})) as ReturnType<typeof inspectRoom>;
    expect(beforeColdRead.validNextAgentMove).toBe("propose_hypothesis kind cold_read");
    await fake.call("propose_hypothesis", { operationId: op(), expectedVersion: latest().stateVersion, kind: "cold_read", text: "Wants to make something that outlives the room." });
    await bridge.sync(latest());
    expect(fake.live().map((tool) => tool.name)).toEqual(expect.arrayContaining(["stage_duel", "ask_once"]));
    for (const [index, lifeRef] of [lives[0].ref, lives[3].ref, lives[5].ref].entries()) {
      await fake.call("stage_duel", {
        operationId: op(),
        expectedVersion: latest().stateVersion,
        testsLifeRef: lifeRef,
        axis: latest().lives.find((life) => life.ref === lifeRef)!.axis,
        variable: `question setup ${index}`,
        a: { line: `Quiet option ${index}.`, scene: "desk" },
        b: { line: `Shared option ${index}.`, scene: "office" },
        bet: { pick: "a", chips: 1, because: "The earlier tap leaned this way." },
      });
      const probe = openProbe(latest())!;
      await person({ type: "react", expectedVersion: latest().stateVersion, probeRef: probe.ref, pick: "a", dwellMs: 900 });
    }
    const before = (await fake.call("inspect_room", {})) as ReturnType<typeof inspectRoom>;
    expect(before.validNextAgentMove).toBe("ask_once");
    const chipsBeforeQuestion = latest().record.chips;
    const asked = await fake.call("ask_once", { operationId: op(), expectedVersion: latest().stateVersion, text: "Which one would you delete first?", options: ["The calendar", "The group chat", "The mirror"] });
    expect(asked.ok).toBe(true);
    await bridge.sync(latest());
    expect(latest().record.chips).toBe(chipsBeforeQuestion - 1);
    const names = fake.live().map((tool) => tool.name);
    expect(names).not.toContain("ask_once");
    expect(names).not.toContain("stage_duel");
    const room = (await fake.call("inspect_room", {})) as ReturnType<typeof inspectRoom>;
    expect((room.openHumanDecision as { kind: string }).kind).toBe("question");
    await person({ type: "answer_question", expectedVersion: latest().stateVersion, questionRef: latest().questions[0].ref, choice: 2 });
    const answered = (await fake.call("inspect_room", {})) as ReturnType<typeof inspectRoom>;
    expect(answered.questions[0].answer).toBe("The mirror");
    expect(fake.live().map((tool) => tool.name)).toContain("stage_duel");
    expect(fake.live().map((tool) => tool.name)).not.toContain("ask_once");
  });

  it("drops describing standing when a paid question moves chips below twenty", async () => {
    const ws = new MemoryStore().load();
    ws.phase = "verdict";
    ws.record.player = "chatgpt";
    ws.record.players = ["chatgpt"];
    ws.record.chips = 20;
    ws.record.misses = 1;
    ws.record.earned = true;
    ws.hypotheses.push({ ref: "cold-threshold", kind: "cold_read", text: "Wants the useful thing beside trusted people.", proofRefs: [], status: "revealed", earned: true, player: "chatgpt", at: 0 });
    ws.probes.push({
      ref: "duel-threshold",
      kind: "duel",
      operationId: "threshold-bet",
      player: "chatgpt",
      lives: [
        { ref: "threshold-a", line: "Makes it alone before dawn.", scene: "workshop", axis: "people_things", pole: "a" },
        { ref: "life-threshold", line: "Makes it beside trusted people.", scene: "workshop", axis: "people_things", pole: "b" },
      ],
      variable: "alone or together",
      testsLifeRef: "life-threshold",
      bet: { pick: "a", chips: 1, because: "The earlier tap leaned solitary." },
      commitment: "19aa",
      stagedAt: 0,
      status: "answered",
    });
    ws.reactions.push({ ref: "miss-threshold", probeRef: "duel-threshold", pick: "b", pickedLifeRef: "life-threshold", dwellMs: 900, betOutcome: "miss", chipsMoved: -1, corrected: true, at: 0 });
    const kernel = new StingKernel(new MemoryStore(ws));
    const asked = await kernel.execute("chatgpt", { type: "ask_once", player: "chatgpt", operationId: op(), expectedVersion: 0, text: "Which part would you keep?", options: ["The craft", "The people", "The quiet"] });
    expect(asked.ok).toBe(true);
    if (!asked.ok) throw new Error(asked.message);
    expect(asked.workspace.record.chips).toBe(19);
    expect(asked.workspace.record.earned).toBe(false);
    expect(inspectRoom(asked.workspace).standing.tier).toBe("betting");
    expect(toolsForRoom(asked.workspace)).toEqual(["inspect_room"]);
  });

  it("shrinks to inspect_room at bust and to no propose_hypothesis under six chips at the verdict", async () => {
    const { latest } = await setup();
    const ws = structuredClone(latest());
    ws.phase = "verdict";
    ws.hypotheses.push({ ref: "cold-test", kind: "cold_read", text: "A cold read.", proofRefs: [], status: "revealed", earned: true, player: "chatgpt", at: ws.stateVersion });
    ws.record.chips = 5;
    expect(toolsForRoom(ws)).toEqual(["inspect_room", "ask_once"]);
    expect(canExternalAgentMove(ws)).toBe(false);
    expect(inspectRoom(ws).validNextAgentMove).toContain("required tool is unavailable");
    ws.record.chips = 6;
    expect(toolsForRoom(ws)).toEqual(["inspect_room", "propose_hypothesis", "ask_once"]);
    expect(canExternalAgentMove(ws)).toBe(true);
    expect(inspectRoom(ws).validNextAgentMove).toContain("propose_hypothesis kind hunger");
    ws.record.chips = 0;
    ws.record.bust = true;
    expect(toolsForRoom(ws)).toEqual(["inspect_room"]);
    expect(inspectRoom(ws, "trust").standing.tier).toBe("silenced");
  });

  it("keeps probation to wagering and correction tools, never later creative tools", () => {
    const duel = new MemoryStore().load();
    duel.phase = "duel";
    duel.record.chips = 5;
    duel.record.player = "chatgpt";
    duel.record.players = ["chatgpt"];
    duel.hypotheses.push({ ref: "cold-probation", kind: "cold_read", text: "Wants room to make something useful.", proofRefs: [], status: "revealed", earned: true, player: "chatgpt", at: 0 });
    expect(toolsForRoom(duel)).toEqual(["inspect_room", "stage_duel", "ask_once"]);

    duel.reactions.push({ ref: "miss-probation", probeRef: "duel-probation", pick: "a", pickedLifeRef: "life-probation", dwellMs: 900, betOutcome: "miss", chipsMoved: -1, corrected: false, at: 1 });
    expect(toolsForRoom(duel)).toEqual(["inspect_room", "propose_hypothesis", "ask_once"]);

    const creative = [
      { phase: "fight", tool: "present_evidence" },
      { phase: "lives", tool: "stage_route_auditions" },
      { phase: "dare", tool: "propose_experiment" },
      { phase: "card", tool: "seal_letter" },
    ] as const;
    const now = new Date("2026-09-03T12:00:00Z");
    for (const { phase, tool } of creative) {
      const room = new MemoryStore().load();
      room.phase = phase;
      room.record.player = "chatgpt";
      room.record.players = ["chatgpt"];
      if (phase === "card") {
        room.brief = { text: "FIELD BRIEF\nReady.", player: "house", at: 0 };
        room.dare = { ref: "dare-probation", lifeRef: "poster-probation", action: "Make one small useful thing.", doneLooksLike: "One finished object.", days: 7, hours: 1, money: 0, currency: "INR", status: "accepted", acceptedAt: 0, dueAt: "2026-09-10T12:00:00Z" };
      }
      room.record.chips = 5;
      expect(toolsForRoom(room, now)).not.toContain(tool);
      room.record.chips = 6;
      expect(toolsForRoom(room, now)).toContain(tool);
    }
  });

  it("seals a letter about the week that nobody can read until the dare is due, then lets reality score it", async () => {
    let now = new Date("2026-09-03T12:00:00Z");
    const { fake, person, latest, bridge, store } = await setup(() => now);
    const ws = structuredClone(latest());
    ws.phase = "card";
    ws.stateVersion = 1;
    ws.chosenPoster = "poster-1";
    ws.dare = { ref: "dare-1", lifeRef: "poster-1", action: "Cook for two people on Thursday.", doneLooksLike: "Two plates, one photo.", days: 7, hours: 2, money: 300, currency: "INR", status: "accepted", acceptedAt: 1, dueAt: "2026-09-10T12:00:00Z" };
    ws.brief = { text: "FIELD BRIEF\nA complete enough deterministic handoff for the test.", player: "house", at: 1 };
    const underfunded = structuredClone(ws);
    underfunded.record.chips = 2;
    expect(toolsForRoom(underfunded, now)).toEqual(["inspect_room"]);
    const poorKernel = new StingKernel(new MemoryStore(underfunded), () => now);
    const poorSeal = await poorKernel.execute("house", { type: "seal_letter", player: "house", operationId: op(), expectedVersion: 1, willDo: true, feeling: "lighter", note: "A fixed stake must be fully funded before it is sealed." });
    expect(poorSeal.ok).toBe(false);
    if (!poorSeal.ok) expect(poorSeal.code).toBe("INSUFFICIENT_CHIPS");
    expect(toolsForRoom(ws, now)).toContain("seal_letter");
    expect(toolsForRoom(ws, new Date("2026-09-11T09:00:00Z"))).not.toContain("seal_letter");
    await store.save(0, ws);
    await bridge.sync(ws);
    expect(fake.live().map((tool) => tool.name)).toEqual(["inspect_room", "seal_letter"]);
    const sealed = await fake.call("seal_letter", { operationId: op(), expectedVersion: 1, willDo: true, feeling: "lighter", note: "You said yes faster than you think you did." });
    expect(sealed.ok).toBe(true);
    expect(typeof sealed.commitment).toBe("string");
    await bridge.sync(latest());
    expect(fake.live().map((tool) => tool.name)).toEqual(["inspect_room"]);
    const view = (await fake.call("inspect_room", { view: "letter" })) as { letter: { status: string; note?: string } };
    expect(view.letter.status).toBe("sealed");
    expect(JSON.stringify(view)).not.toContain("faster than you think");
    const early = await person({ type: "open_letter", expectedVersion: latest().stateVersion, didIt: true, feltLikeIt: true }).catch((error: Error) => error.message);
    expect(early).toContain("LETTER_SEALED");
    now = new Date("2026-09-11T09:00:00Z");
    await person({ type: "open_letter", expectedVersion: latest().stateVersion, didIt: true, feltLikeIt: false });
    expect(latest().letter?.opened?.outcome).toBe("hit");
    expect(latest().record.chips).toBe(15);
    const handoff = (await fake.call("inspect_room", { view: "handoff" })) as { handoff: { cannot: string[]; letter: string } };
    expect(handoff.handoff.cannot).toContain("stage_duel");
    expect(handoff.handoff.letter).toContain("opened");
  });

  it("records the actual letter loss and marks a zero-chip player bust", async () => {
    let now = new Date("2026-09-03T12:00:00Z");
    const { latest } = await setup(() => now);
    const ws = structuredClone(latest());
    ws.phase = "card";
    ws.stateVersion = 1;
    ws.record.chips = 3;
    ws.record.earned = true;
    ws.chosenPoster = "poster-1";
    ws.dare = { ref: "dare-1", lifeRef: "poster-1", action: "Cook for two people on Thursday.", doneLooksLike: "Two plates, one photo.", days: 7, hours: 2, money: 0, currency: "INR", status: "accepted", acceptedAt: 1, dueAt: "2026-09-10T12:00:00Z" };
    ws.brief = { text: "FIELD BRIEF\nReady.", player: "house", at: 1 };
    const kernel = new StingKernel(new MemoryStore(ws), () => now);
    let result = await kernel.execute("house", { type: "seal_letter", player: "house", operationId: op(), expectedVersion: 1, willDo: true, feeling: "lighter", note: "The week will tell us whether the bet deserved its confidence." });
    expect(result.ok).toBe(true);
    now = new Date("2026-09-11T09:00:00Z");
    result = await kernel.execute("participant", { type: "open_letter", operationId: op(), expectedVersion: 2, didIt: false, feltLikeIt: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.workspace.letter?.opened?.chipsMoved).toBe(-3);
      expect(result.workspace.record.chips).toBe(0);
      expect(result.workspace.record.bust).toBe(true);
      expect(result.workspace.record.earned).toBe(false);
    }
  });

  it("denies a cached call after the catalogue changed, and rewrites propose_hypothesis after a kill", async () => {
    const { fake, person, latest, bridge } = await setup();
    await person({ type: "start", expectedVersion: 0 });
    const stale = fake.live().find((tool) => tool.name === "stage_cast")!;
    await fake.call("stage_cast", { operationId: op(), expectedVersion: latest().stateVersion, lives: eightLives });
    const lives = latest().lives;
    for (const ref of [lives[0].ref, lives[3].ref, lives[5].ref]) await person({ type: "pick_life", expectedVersion: latest().stateVersion, lifeRef: ref, dwellMs: 900 });
    const denied = (await stale.execute({ operationId: op(), expectedVersion: latest().stateVersion, lives: eightLives })) as { denied?: { code: string }; isError?: boolean };
    expect(denied.denied?.code).toBe("STALE_REGISTRATION");
    expect(denied.isError).toBe(true);

    // Force a verdict-phase room with a killed line to check the description carries it.
    const ws = structuredClone(latest());
    ws.phase = "verdict";
    ws.hypotheses.push({ ref: "cold-test", kind: "cold_read", text: "A cold read.", proofRefs: [], status: "revealed", earned: true, player: "chatgpt", at: ws.stateVersion });
    ws.kills.push({ hypothesisRef: "hyp-x", text: "Money to shut the noise.", at: ws.stateVersion });
    await bridge.sync(ws);
    const propose = fake.live().find((tool) => tool.name === "propose_hypothesis")!;
    expect(propose.description).toContain('Money to shut the noise.');
    expect(catalogueKey(ws)).not.toBe(catalogueKey(latest()));
    // A rule the person typed rides along in the same description, and the description never exceeds Chrome's budget.
    ws.rules.push({ ref: "rule-1", text: "Never bring up my father.", source: "you", at: ws.stateVersion });
    for (let index = 0; index < 8; index += 1) ws.kills.push({ hypothesisRef: `hyp-${index}`, text: `A long killed line number ${index} about wanting to be seen by everyone.`, at: ws.stateVersion });
    await bridge.sync(ws);
    const crowded = fake.live().find((tool) => tool.name === "propose_hypothesis")!;
    expect(crowded.description).toContain("Never bring up my father.");
    expect(crowded.description.length).toBeLessThanOrEqual(500);
    expect(inspectRoom(ws, "rules").rulesOfMe).toHaveLength(10);
  });

  it("invalidates every visiting tool when the person hands the room to an in-page player", async () => {
    const { fake, person, latest, bridge } = await setup();
    await person({ type: "start", expectedVersion: 0 });
    const cached = fake.live().find((tool) => tool.name === "stage_cast")!;
    bridge.suspend();
    expect(bridge.connected).toBe(false);
    expect(fake.live()).toEqual([]);

    const denied = (await cached.execute({ operationId: op(), expectedVersion: latest().stateVersion, lives: eightLives })) as { denied?: { code: string } };
    expect(denied.denied?.code).toBe("STALE_REGISTRATION");
    expect(latest().lives).toHaveLength(0);

    await bridge.sync(latest());
    expect(fake.live()).toEqual([]);
  });

  it("revokes a write already in flight without persisting its lives or receipt", async () => {
    const inner = new MemoryStore();
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const paused = new Promise<void>((resolve) => { entered = resolve; });
    const store: StingStore = {
      load: () => inner.load(),
      clear: () => inner.clear(),
      async save(expectedVersion, next, commitIf) {
        if (next.lives.length > 0) {
          entered();
          await gate;
        }
        await inner.save(expectedVersion, next, commitIf);
      },
    };
    const { fake, person, latest, bridge } = await setup(() => new Date(), store);
    await person({ type: "start", expectedVersion: 0 });
    const pending = fake.call("stage_cast", {
      operationId: op(),
      expectedVersion: latest().stateVersion,
      lives: eightLives,
    });
    await paused;
    bridge.suspend();
    release();
    const result = await pending as { denied?: { code: string }; isError?: boolean };
    expect(result.isError).toBe(true);
    expect(result.denied?.code).toBe("STALE_REGISTRATION");
    const saved = inner.load();
    expect(saved.lives).toEqual([]);
    expect(saved.receipts.map((receipt) => receipt.command)).not.toContain("stage_cast");
  });

  it("removes seal_letter at the due instant without mutating the room", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-09-03T12:00:00.000Z");
    vi.setSystemTime(now);
    const ws = new MemoryStore().load();
    ws.phase = "card";
    ws.stateVersion = 1;
    ws.record.chips = 20;
    ws.chosenPoster = "poster-1";
    ws.dare = {
      ref: "dare-1",
      lifeRef: "poster-1",
      action: "Cook for two people on Thursday.",
      doneLooksLike: "Two plates and one photo.",
      days: 1,
      hours: 2,
      money: 0,
      currency: "INR",
      status: "accepted",
      acceptedAt: 1,
      dueAt: new Date(now.getTime() + 1_000).toISOString(),
    };
    ws.brief = { text: "FIELD BRIEF\nReady for the week.", player: "house", at: 1 };
    const store = new MemoryStore(ws);
    const { fake, bridge } = await setup(() => new Date(Date.now()), store);
    expect(houseMove(ws, new Date(now.getTime() + 999))?.type).toBe("seal_letter");
    expect(requiredMove(ws, new Date(now.getTime() + 999))).toBe("letter");
    expect(fake.live().map((tool) => tool.name)).toEqual(["inspect_room", "seal_letter"]);
    const before = store.load();
    await vi.advanceTimersByTimeAsync(1_100);
    await vi.runAllTimersAsync();
    expect(houseMove(ws, new Date(Date.now()))).toBeNull();
    expect(requiredMove(ws, new Date(Date.now()))).toBeNull();
    expect(fake.live().map((tool) => tool.name)).toEqual(["inspect_room"]);
    const after = store.load();
    expect(after.stateVersion).toBe(before.stateVersion);
    expect(after.letter).toBeUndefined();
    expect(after.receipts).toEqual(before.receipts);
    bridge.stop();
  });
});

describe("STING WebMCP voice and choice", () => {
  it("shows ordinary asides but structurally suppresses an aside on a sealed bet", async () => {
    const { fake, person, latest, bridge } = await setup();
    await person({ type: "start", expectedVersion: 0 });
    const cast = await fake.call("stage_cast", { operationId: op(), expectedVersion: latest().stateVersion, lives: eightLives, aside: "Eight doors. Two of them are yours." });
    expect(cast.ok).toBe(true);
    expect(latest().voice.at(-1)?.text).toBe("Eight doors. Two of them are yours.");
    await bridge.sync(latest());
    const lives = latest().lives;
    for (const ref of [lives[0].ref, lives[3].ref, lives[5].ref]) await person({ type: "pick_life", expectedVersion: latest().stateVersion, lifeRef: ref, dwellMs: 900 });
    await fake.call("propose_hypothesis", { operationId: op(), expectedVersion: latest().stateVersion, kind: "cold_read", text: "Wants the quiet room." });
    await bridge.sync(latest());
    const duel = await fake.call("stage_duel", { operationId: op(), expectedVersion: latest().stateVersion, testsLifeRef: lives[0].ref, axis: "autonomy_belonging", variable: "alone or reachable", a: { line: "Yours alone.", scene: "beach" }, b: { line: "Shared.", scene: "office" }, bet: { pick: "b", chips: 1, because: "guess" }, aside: "I picked the second life." });
    expect(duel.ok).toBe(true);
    const room = (await fake.call("inspect_room", {})) as ReturnType<typeof inspectRoom>;
    expect(JSON.stringify(room)).not.toContain("guess");
    expect(latest().voice.at(-1)?.text).toBe("Eight doors. Two of them are yours.");
    expect(JSON.stringify(latest().activity)).not.toContain("second life");
  });
});
