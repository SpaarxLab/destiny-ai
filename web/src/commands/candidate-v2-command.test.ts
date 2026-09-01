import { describe, expect, it } from "vitest";
import { createParticipantCommandAdapter } from "../adapters/participant-command-adapter";
import { createWebMcpCommandAdapter } from "../adapters/webmcp-command-adapter";
import { createEmbeddedCommandAdapter } from "../adapters/embedded-command-adapter";
import { MemoryWorkspaceStore } from "../storage/memory-workspace-store";
import { CommandKernel, type CommandEnvironment } from "./command-kernel";
import { p3Workspace, validRoutes } from "./fixtures/p3-route-set";

const ids = Array.from({ length: 12 }, (_, index) => `00000000-0000-4000-8000-${String(index + 900).padStart(12, "0")}`);

function environment(): CommandEnvironment {
  let id = 700;
  return {
    now: () => "2026-09-02T10:00:00.000Z",
    createId: () => `00000000-0000-4000-8000-${String(id++).padStart(12, "0")}`,
  };
}

function setup(initial = p3Workspace()) {
  const store = new MemoryWorkspaceStore(initial);
  const kernel = new CommandKernel(store, environment());
  return {
    store,
    kernel,
    participant: createParticipantCommandAdapter(kernel),
    agent: createWebMcpCommandAdapter(kernel),
    embedded: createEmbeddedCommandAdapter(kernel),
  };
}

const limits = { hoursPerWeek: 4, money: 50, currency: "USD" };

describe("set_limits", () => {
  it("records limits with a receipt and rejects an identical no-op", async () => {
    const { store, participant } = setup();
    const result = await participant.setLimits({ operationId: ids[0], expectedVersion: 0, costCaps: limits, focusQuestion: "What is worth testing next?" });
    expect(result).toMatchObject({
      ok: true,
      data: { participant: { costCaps: limits, focusQuestion: "What is worth testing next?" } },
      receipt: { command: "set_limits", effect: "APPLIED", changedRefs: [store.load().id], afterVersion: 1 },
    });
    const noop = await participant.setLimits({ operationId: ids[1], expectedVersion: 1, costCaps: limits });
    expect(noop).toMatchObject({ ok: false, error: { code: "POLICY_DENIED" }, stateVersion: 1 });
    const replay = await participant.setLimits({ operationId: ids[0], expectedVersion: 1, costCaps: limits, focusQuestion: "What is worth testing next?" });
    expect(replay).toMatchObject({ ok: true, receipt: result.receipt, guidance: expect.stringContaining("Replay") });
  });

  it("denies limits that a proposed route would exceed, and denies agents", async () => {
    const { store, participant, agent } = setup();
    await agent.proposeRouteSet({ operationId: ids[0], expectedVersion: 0, outcome: "routes", routes: validRoutes() });
    const denied = await participant.setLimits({ operationId: ids[1], expectedVersion: 1, costCaps: { hoursPerWeek: 1, money: 100, currency: "USD" } });
    expect(denied).toMatchObject({ ok: false, error: { code: "POLICY_DENIED", changedRefs: ["route-set-1"] }, stateVersion: 1 });
    expect(store.load().participant.costCaps.hoursPerWeek).toBe(6);
    const kernel = new CommandKernel(store, environment());
    const wrongActor = await kernel.execute({ actor: "agent", proposalSource: "chatgpt_webmcp" }, {
      name: "set_limits",
      input: { operationId: ids[2], expectedVersion: 1, costCaps: limits },
    });
    expect(wrongActor.error?.code).toBe("WRONG_ACTOR");
  });

  it("rejects malformed limits before policy", async () => {
    const { participant } = setup();
    const result = await participant.setLimits({ operationId: ids[0], expectedVersion: 0, costCaps: { hoursPerWeek: 0, money: 0, currency: "usd" } });
    expect(result.error?.code).toBe("MALFORMED_INPUT");
  });
});

describe("follow-up questions", () => {
  const question = {
    outcome: "insufficient_signal" as const,
    followUpQuestion: "Which recent task did you want to repeat, and why?",
    reasonRefs: ["reflection-grounded"],
  };

  it("lets the participant answer in their own words and links the reflection", async () => {
    const { store, participant, agent } = setup();
    const asked = await agent.proposeRouteSet({ operationId: ids[0], expectedVersion: 0, ...question });
    expect(asked.ok).toBe(true);
    const answered = await participant.saveReflection({
      operationId: ids[1], expectedVersion: 1, text: "I wanted to repeat the workshop I ran last month.", answersFollowUpRef: "question-1",
    });
    expect(answered).toMatchObject({
      ok: true,
      data: { reflection: { ref: "reflection-2", status: "confirmed", answersFollowUpRef: "question-1" }, answeredFollowUp: { ref: "question-1", status: "answered", answerReflectionRef: "reflection-2" } },
      receipt: { changedRefs: ["reflection-2", "question-1"], afterVersion: 2 },
    });
    expect(store.load().followUpQuestions[0].availableActions).toEqual([]);
    const replay = await participant.saveReflection({
      operationId: ids[1], expectedVersion: 2, text: "I wanted to repeat the workshop I ran last month.", answersFollowUpRef: "question-1",
    });
    expect(replay).toMatchObject({ ok: true, receipt: answered.receipt, data: { answeredFollowUp: { status: "answered" } } });
    const again = await participant.saveReflection({ operationId: ids[2], expectedVersion: 2, text: "Another answer.", answersFollowUpRef: "question-1" });
    expect(again.error?.code).toBe("WRONG_LIFECYCLE");
    const unknown = await participant.saveReflection({ operationId: ids[3], expectedVersion: 2, text: "Another answer.", answersFollowUpRef: "question-9" });
    expect(unknown.error?.code).toBe("UNKNOWN_REF");
  });

  it("denies agents answering, participants asking, double asking, and asking while routes wait", async () => {
    const { store, participant, agent } = setup();
    const kernel = new CommandKernel(store, environment());
    const participantAsks = await participant.proposeRouteSet({ operationId: ids[0], expectedVersion: 0, ...question });
    expect(participantAsks).toMatchObject({ ok: false, error: { code: "POLICY_DENIED" } });
    await agent.proposeRouteSet({ operationId: ids[1], expectedVersion: 0, ...question });
    const agentAnswers = await kernel.execute({ actor: "agent", proposalSource: "chatgpt_webmcp" }, {
      name: "save_reflection",
      input: { operationId: ids[2], expectedVersion: 1, text: "I answer for you.", answersFollowUpRef: "question-1" },
    });
    expect(agentAnswers.error?.code).toBe("POLICY_DENIED");
    const second = await agent.proposeRouteSet({ operationId: ids[3], expectedVersion: 1, ...question });
    expect(second).toMatchObject({ ok: false, error: { code: "WRONG_LIFECYCLE", changedRefs: ["question-1"] } });
    await participant.skipFollowUp({ operationId: ids[4], expectedVersion: 1, followUpRef: "question-1" });
    await agent.proposeRouteSet({ operationId: ids[5], expectedVersion: 2, outcome: "routes", routes: validRoutes() });
    const whileRoutesWait = await agent.proposeRouteSet({ operationId: ids[6], expectedVersion: 3, ...question });
    expect(whileRoutesWait).toMatchObject({ ok: false, error: { code: "WRONG_LIFECYCLE", changedRefs: ["route-set-3"] } });
    expect(store.load().stateVersion).toBe(3);
  });

  it("skips with a receipt and denies a second skip", async () => {
    const { store, participant, agent } = setup();
    await agent.proposeRouteSet({ operationId: ids[0], expectedVersion: 0, ...question });
    const skipped = await participant.skipFollowUp({ operationId: ids[1], expectedVersion: 1, followUpRef: "question-1" });
    expect(skipped).toMatchObject({ ok: true, data: { followUp: { status: "skipped" } }, receipt: { command: "skip_follow_up", changedRefs: ["question-1"] } });
    const replay = await participant.skipFollowUp({ operationId: ids[1], expectedVersion: 2, followUpRef: "question-1" });
    expect(replay).toMatchObject({ ok: true, receipt: skipped.receipt });
    const twice = await participant.skipFollowUp({ operationId: ids[2], expectedVersion: 2, followUpRef: "question-1" });
    expect(twice.error?.code).toBe("WRONG_LIFECYCLE");
    expect(store.load().stateVersion).toBe(2);
  });

  it("withdraws an open question when routes are proposed, with the question first in changedRefs", async () => {
    const { store, agent, embedded } = setup();
    await embedded.proposeRouteSet({ operationId: ids[0], expectedVersion: 0, ...question });
    expect(store.load().followUpQuestions[0].askedBy).toBe("embedded_inference");
    const proposed = await agent.proposeRouteSet({ operationId: ids[1], expectedVersion: 1, outcome: "routes", routes: validRoutes() });
    expect(proposed).toMatchObject({ ok: true, receipt: { changedRefs: ["question-1", "route-set-2"] } });
    expect(store.load().followUpQuestions[0].status).toBe("withdrawn");
  });
});

describe("reopen_exploring", () => {
  it("parks the chosen direction, returns to exploring, and requires the resolved set as predecessor", async () => {
    const { store, participant, agent } = setup();
    await agent.proposeRouteSet({ operationId: ids[0], expectedVersion: 0, outcome: "routes", routes: validRoutes() });
    const wrongPhase = await participant.reopenExploring({ operationId: ids[1], expectedVersion: 1, hypothesisRef: "hypothesis-2" });
    expect(wrongPhase.error?.code).toBe("WRONG_PHASE");
    await participant.chooseRoute({ operationId: ids[2], expectedVersion: 1, routeSetRef: "route-set-1", routeRef: "route-bridge" });
    expect(store.load().phase).toBe("TESTING");
    const kernel = new CommandKernel(store, environment());
    const agentReopen = await kernel.execute({ actor: "agent", proposalSource: "chatgpt_webmcp" }, {
      name: "reopen_exploring",
      input: { operationId: ids[3], expectedVersion: 2, hypothesisRef: "hypothesis-2" },
    });
    expect(agentReopen.error?.code).toBe("WRONG_ACTOR");
    const reopened = await participant.reopenExploring({ operationId: ids[4], expectedVersion: 2, hypothesisRef: "hypothesis-2" });
    expect(reopened).toMatchObject({ ok: true, data: { hypothesis: { status: "parked" } }, receipt: { command: "reopen_exploring", changedRefs: ["hypothesis-2"], afterVersion: 3 } });
    expect(store.load().phase).toBe("EXPLORING");
    const replay = await participant.reopenExploring({ operationId: ids[4], expectedVersion: 3, hypothesisRef: "hypothesis-2" });
    expect(replay).toMatchObject({ ok: true, receipt: reopened.receipt });
    const uncited = await agent.proposeRouteSet({ operationId: ids[5], expectedVersion: 3, outcome: "routes", routes: validRoutes().map((route) => ({ ...route, ref: `${route.ref}-2` })) as never });
    expect(uncited).toMatchObject({ ok: false, error: { code: "WRONG_LIFECYCLE", changedRefs: ["route-set-1"] } });
    const cited = await agent.proposeRouteSet({ operationId: ids[6], expectedVersion: 3, outcome: "routes", supersedesRouteSetRef: "route-set-1", routes: validRoutes().map((route) => ({ ...route, ref: `${route.ref}-2` })) as never });
    expect(cited.ok).toBe(true);
    expect(store.load().routeProposalSets.map((set) => set.status)).toEqual(["resolved", "proposed"]);
  });
});
