import { describe, expect, it } from "vitest";
import { openProbe, type Workspace } from "./domain";
import { StingKernel, type Command, type PendingMove } from "./kernel";
import { MemoryStore } from "./store";
import { StingWebMcp, catalogueKey, inspectRoom, toolsForRoom } from "./webmcp";
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

async function setup(clock: () => Date = () => new Date()) {
  const store = new MemoryStore();
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
    expect(fake.live().map((tool) => tool.name)).toEqual(["inspect_room", "stage_cast", "propose_hypothesis"]);
    expect(changes).toEqual([["stage_cast", "propose_hypothesis"]]);
    for (const tool of fake.live()) {
      expect(tool.description.length).toBeLessThanOrEqual(500);
      expect(tool.title).toBeTruthy();
    }
  });

  it("has no tool that taps, kills, crowns or accepts; only the person moves the room forward", async () => {
    const { fake, person } = await setup();
    await person({ type: "start", expectedVersion: 0 });
    const names = fake.live().map((tool) => tool.name);
    for (const forbidden of ["pick_life", "react", "kill", "crown", "choose_poster", "accept_dare", "keep_all", "answer_question", "add_rule", "open_letter"]) expect(names).not.toContain(forbidden);
  });

  it("casts through stage_probe, hides the sealed bet from inspect_room until the tap, then reveals it with the commitment", async () => {
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
    expect(fake.live().map((tool) => tool.name)).toContain("ask_once");
    const asked = await fake.call("ask_once", { operationId: op(), expectedVersion: latest().stateVersion, text: "Which one would you delete first?", options: ["The calendar", "The group chat", "The mirror"] });
    expect(asked.ok).toBe(true);
    await bridge.sync(latest());
    expect(latest().record.chips).toBe(11);
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

  it("shrinks to inspect_room at bust and to no propose_hypothesis under six chips at the verdict", async () => {
    const { latest } = await setup();
    const ws = structuredClone(latest());
    ws.phase = "verdict";
    ws.record.chips = 5;
    expect(toolsForRoom(ws)).toEqual(["inspect_room", "ask_once"]);
    ws.record.chips = 6;
    expect(toolsForRoom(ws)).toEqual(["inspect_room", "propose_hypothesis", "ask_once"]);
    ws.record.chips = 0;
    ws.record.bust = true;
    expect(toolsForRoom(ws)).toEqual(["inspect_room"]);
    expect(inspectRoom(ws, "trust").standing.tier).toBe("silenced");
  });

  it("seals a letter about the week that nobody can read until the dare is due, then lets reality score it", async () => {
    let now = new Date("2026-09-03T12:00:00Z");
    const { fake, person, latest, bridge, store } = await setup(() => now);
    const ws = structuredClone(latest());
    ws.phase = "card";
    ws.stateVersion = 1;
    ws.chosenPoster = "poster-1";
    ws.dare = { ref: "dare-1", lifeRef: "poster-1", action: "Cook for two people on Thursday.", doneLooksLike: "Two plates, one photo.", days: 7, hours: 2, money: 300, currency: "INR", status: "accepted", acceptedAt: 1, dueAt: "2026-09-10T12:00:00Z" };
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
});

describe("STING WebMCP voice and choice", () => {
  it("lets a tool call carry an aside the person sees, but never one that leaks the bet", async () => {
    const { fake, person, latest, bridge } = await setup();
    await person({ type: "start", expectedVersion: 0 });
    const cast = await fake.call("stage_cast", { operationId: op(), expectedVersion: latest().stateVersion, lives: eightLives, aside: "Eight doors. Two of them are yours." });
    expect(cast.ok).toBe(true);
    expect(latest().voice.at(-1)?.text).toBe("Eight doors. Two of them are yours.");
    await bridge.sync(latest());
    const lives = latest().lives;
    for (const ref of [lives[0].ref, lives[3].ref, lives[5].ref]) await person({ type: "pick_life", expectedVersion: latest().stateVersion, lifeRef: ref, dwellMs: 900 });
    const leaky = await fake.call("stage_duel", { operationId: op(), expectedVersion: latest().stateVersion, testsLifeRef: lives[0].ref, axis: "autonomy_belonging", variable: "alone or reachable", a: { line: "Yours alone.", scene: "beach" }, b: { line: "Shared.", scene: "office" }, bet: { pick: "b", chips: 1, because: "guess" }, aside: "I bet b, two chips." });
    expect(leaky.ok).toBe(false);
    expect((leaky.denied as { code: string }).code).toBe("PREDICTION_LANGUAGE");
    const fine = await fake.call("stage_duel", { operationId: op(), expectedVersion: latest().stateVersion, testsLifeRef: lives[0].ref, axis: "autonomy_belonging", variable: "alone or reachable", a: { line: "Yours alone.", scene: "beach" }, b: { line: "Shared.", scene: "office" }, bet: { pick: "b", chips: 1, because: "guess" }, aside: "You paused on the quiet one. Let's see." });
    expect(fine.ok).toBe(true);
    const room = (await fake.call("inspect_room", {})) as ReturnType<typeof inspectRoom>;
    expect(JSON.stringify(room)).not.toContain("guess");
    expect(latest().voice.at(-1)?.text).toBe("You paused on the quiet one. Let's see.");
  });
});
