import { describe, expect, it } from "vitest";
import type { Command } from "../domain/commands";
import { workspaceSchema, type Workspace } from "../domain/workspace";
import { MemoryWorkspaceStore } from "../storage/memory-workspace-store";
import { WorkspaceStoreError, type WorkspaceStore } from "../storage/workspace-store";
import { CommandKernel, type CommandEnvironment } from "./command-kernel";
import { p3Workspace, validRoutes } from "./fixtures/p3-route-set";

const operationOne = "00000000-0000-4000-8000-000000000011";
const operationTwo = "00000000-0000-4000-8000-000000000012";
const operationThree = "00000000-0000-4000-8000-000000000013";

function environment(): CommandEnvironment {
  let id = 200;
  return {
    now: () => "2026-09-01T10:00:00.000Z",
    createId: () => `00000000-0000-4000-8000-${String(id++).padStart(12, "0")}`,
  };
}

function setup(initial = p3Workspace()) {
  const store = new MemoryWorkspaceStore(initial);
  return { store, kernel: new CommandKernel(store, environment()) };
}

function propose(operationId = operationOne, expectedVersion = 0, actor: "agent" | "participant" = "agent"): Command {
  return {
    name: "propose_route_set",
    actor,
    input: {
      operationId,
      expectedVersion,
      outcome: "routes",
      routes: validRoutes(),
      createdBy: actor === "participant" ? "participant" : "chatgpt_webmcp",
    },
  };
}

describe("P3A route proposal and participant choice", () => {
  it.each(["agent", "participant"] as const)("stores one bounded route proposal from the %s actor", async (actor) => {
    const { store, kernel } = setup();
    const result = await kernel.execute(propose(operationOne, 0, actor));

    expect(result).toMatchObject({ ok: true, data: { outcome: "routes" }, stateVersion: 1 });
    expect(result.receipt).toMatchObject({ effect: "PROPOSED", changedRefs: ["route-set-1"] });
    const routeSet = store.load().routeProposalSets[0];
    expect(routeSet.routes.map((route) => route.kind)).toEqual(["closest", "bridge", "probe"]);
    expect(routeSet.availableActions.map((action) => [action.tool, action.actor])).toEqual([
      ["revise_route_set", "participant"],
      ["choose_route", "participant"],
      ["compensate_route_set", "participant"],
    ]);
  });

  it("returns INSUFFICIENT_SIGNAL with one question and no mutation or receipt", async () => {
    const { store, kernel } = setup();
    const before = store.load();
    const result = await kernel.execute({
      name: "propose_route_set",
      actor: "agent",
      input: {
        operationId: operationOne,
        expectedVersion: 0,
        outcome: "insufficient_signal",
        followUpQuestion: "Which recent task felt absorbing enough to repeat?",
        reasonRefs: ["reflection-grounded"],
      },
    });

    expect(result).toMatchObject({ ok: false, error: { code: "INSUFFICIENT_SIGNAL" }, stateVersion: 0 });
    expect(result).not.toHaveProperty("receipt");
    expect(store.load()).toEqual(before);
  });

  it.each([
    ["duplicate kind", (routes: ReturnType<typeof validRoutes>) => { routes[2].kind = "bridge"; }],
    ["duplicate ref", (routes: ReturnType<typeof validRoutes>) => { routes[2].ref = routes[1].ref; }],
    ["same question", (routes: ReturnType<typeof validRoutes>) => { routes[2].learningQuestion = routes[1].learningQuestion; }],
    ["same test", (routes: ReturnType<typeof validRoutes>) => { routes[2].test = routes[1].test; }],
    ["fabricated quote", (routes: ReturnType<typeof validRoutes>) => { routes[0].sourceQuotes[0].quote = "words never said"; }],
    ["unconfirmed ref", (routes: ReturnType<typeof validRoutes>) => { routes[0].sourceQuotes[0].reflectionRef = "reflection-other-workspace"; }],
    ["time cap", (routes: ReturnType<typeof validRoutes>) => { routes[0].test.maximumHours = 7; }],
    ["money cap", (routes: ReturnType<typeof validRoutes>) => { routes[0].test.maximumMoney = 101; }],
    ["currency cap", (routes: ReturnType<typeof validRoutes>) => { routes[0].test.currency = "EUR"; }],
  ] as const)("denies %s without mutation", async (_label, mutate) => {
    const { store, kernel } = setup();
    const routes = validRoutes();
    mutate(routes);
    const command = propose() as Extract<Command, { name: "propose_route_set" }>;
    if (command.input.outcome !== "routes") throw new Error("fixture error");
    command.input.routes = routes;
    const result = await kernel.execute(command);
    expect(result.ok).toBe(false);
    expect(["POLICY_DENIED", "UNKNOWN_REF"]).toContain(result.error?.code);
    expect(store.load().stateVersion).toBe(0);
  });

  it.each([
    ["more than seven days", { maximumDays: 8 }],
    ["extra field", { hiddenRank: 1 }],
  ])("rejects malformed %s input before policy", async (_label, changes) => {
    const { store, kernel } = setup();
    const command = propose() as Extract<Command, { name: "propose_route_set" }>;
    if (command.input.outcome !== "routes") throw new Error("fixture error");
    Object.assign(command.input.routes[0].test, changes);
    const result = await kernel.execute(command);
    expect(result.error?.code).toBe("MALFORMED_INPUT");
    expect(store.load().stateVersion).toBe(0);
  });

  it("enforces authenticated proposal authorship", async () => {
    const { kernel } = setup();
    const command = propose() as Extract<Command, { name: "propose_route_set" }>;
    if (command.input.outcome !== "routes") throw new Error("fixture error");
    command.input.createdBy = "participant";
    expect((await kernel.execute(command)).error?.code).toBe("WRONG_ACTOR");
  });

  it("lets only the participant edit and reject routes before choice", async () => {
    const { store, kernel } = setup();
    await kernel.execute(propose());
    const agentDenied = await kernel.execute({
      name: "revise_route_set", actor: "agent",
      input: { operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1", edits: [], rejectRouteRefs: ["route-probe"] },
    });
    expect(agentDenied.error?.code).toBe("WRONG_ACTOR");

    const revised = await kernel.execute({
      name: "revise_route_set", actor: "participant",
      input: {
        operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1",
        edits: [{ routeRef: "route-closest", premise: "A participant-edited systems explanation direction." }],
        rejectRouteRefs: ["route-probe"],
      },
    });
    expect(revised.ok).toBe(true);
    expect(store.load().routeProposalSets[0].routes.map((route) => route.status)).toEqual(["edited", "proposed", "rejected"]);
  });

  it("resolves an all-rejected set without creating a hypothesis", async () => {
    const { store, kernel } = setup();
    await kernel.execute(propose());
    const result = await kernel.execute({
      name: "revise_route_set", actor: "participant",
      input: {
        operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1", edits: [],
        rejectRouteRefs: ["route-closest", "route-bridge", "route-probe"],
      },
    });
    expect(result.data?.routeSet.status).toBe("resolved");
    expect(store.load().hypotheses).toEqual([]);
    expect(store.load().phase).toBe("EXPLORING");
  });

  it("preserves supersession lineage and both proposal receipts", async () => {
    const { store, kernel } = setup();
    await kernel.execute(propose());
    const replacement = propose(operationTwo, 1) as Extract<Command, { name: "propose_route_set" }>;
    if (replacement.input.outcome !== "routes") throw new Error("fixture error");
    replacement.input.routes = replacement.input.routes.map((route) => ({ ...route, ref: `${route.ref}-v2` })) as typeof replacement.input.routes;
    replacement.input.supersedesRouteSetRef = "route-set-1";
    const result = await kernel.execute(replacement);
    expect(result.receipt?.changedRefs).toEqual(["route-set-1", "route-set-2"]);
    expect(store.load().routeProposalSets.map((set) => [set.ref, set.status, set.supersedesRouteSetRef])).toEqual([
      ["route-set-1", "superseded", undefined],
      ["route-set-2", "proposed", "route-set-1"],
    ]);
    expect(store.load().operations).toHaveLength(2);
  });

  it.each([false, true])("chooses exactly one route with finalEdit=%s and records lineage atomically", async (withEdit) => {
    const { store, kernel } = setup();
    await kernel.execute(propose());
    const result = await kernel.execute({
      name: "choose_route", actor: "participant",
      input: {
        operationId: operationTwo, expectedVersion: 1,
        routeSetRef: "route-set-1", routeRef: "route-bridge",
        ...(withEdit ? { finalEdit: { routeRef: "route-bridge", premise: "The final participant-edited bridge claim." } } : {}),
      },
    });
    expect(result.ok).toBe(true);
    const state = store.load();
    expect(state.phase).toBe("TESTING");
    expect(state.hypotheses).toHaveLength(1);
    expect(state.hypotheses[0]).toMatchObject({
      status: "accepted", originatingRouteSetRef: "route-set-1", originatingRouteRef: "route-bridge",
      claim: withEdit ? "The final participant-edited bridge claim." : validRoutes()[1].premise,
    });
    expect(state.routeProposalSets[0].routes.filter((route) => route.status === "selected")).toHaveLength(1);
    expect(result.receipt?.changedRefs).toEqual(["route-set-1", "hypothesis-2"]);
  });

  it("denies agent choice and rejected-route choice", async () => {
    const { kernel } = setup();
    await kernel.execute(propose());
    expect((await kernel.execute({
      name: "choose_route", actor: "agent",
      input: { operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1", routeRef: "route-closest" },
    })).error?.code).toBe("WRONG_ACTOR");
    await kernel.execute({
      name: "revise_route_set", actor: "participant",
      input: { operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1", edits: [], rejectRouteRefs: ["route-closest"] },
    });
    expect((await kernel.execute({
      name: "choose_route", actor: "participant",
      input: { operationId: operationThree, expectedVersion: 2, routeSetRef: "route-set-1", routeRef: "route-closest" },
    })).error?.code).toBe("WRONG_LIFECYCLE");
  });

  it("returns same-id replay, stale denial, and same-id conflict without duplicate effects", async () => {
    const { store, kernel } = setup();
    const first = await kernel.execute(propose());
    const replay = await kernel.execute(propose(operationOne, 1));
    expect(replay.receipt).toEqual(first.receipt);
    expect(store.load().routeProposalSets).toHaveLength(1);

    expect((await kernel.execute(propose(operationTwo, 0))).error?.code).toBe("STALE_STATE");
    const conflicting = propose(operationOne, 1) as Extract<Command, { name: "propose_route_set" }>;
    if (conflicting.input.outcome !== "routes") throw new Error("fixture error");
    conflicting.input.routes[0].title = "Different intent";
    expect((await kernel.execute(conflicting)).error?.code).toBe("OPERATION_CONFLICT");
    expect(store.load().operations).toHaveLength(1);
  });

  it("compensates only an untouched proposal and preserves both history records", async () => {
    const { store, kernel } = setup();
    await kernel.execute(propose());
    const result = await kernel.execute({
      name: "compensate_route_set", actor: "participant",
      input: { operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1" },
    });
    expect(result).toMatchObject({ ok: true, receipt: { effect: "COMPENSATED", compensatesOperationRef: "operation-1" } });
    expect(store.load().routeProposalSets[0].status).toBe("resolved");
    expect(store.load().operations).toHaveLength(2);
  });

  it("denies compensation after revision", async () => {
    const { kernel } = setup();
    await kernel.execute(propose());
    await kernel.execute({
      name: "revise_route_set", actor: "participant",
      input: { operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1", edits: [], rejectRouteRefs: ["route-probe"] },
    });
    expect((await kernel.execute({
      name: "compensate_route_set", actor: "participant",
      input: { operationId: operationThree, expectedVersion: 2, routeSetRef: "route-set-1" },
    })).error?.code).toBe("POLICY_DENIED");
  });

  it("denies wrong phase, lifecycle, and cross-workspace refs", async () => {
    const wrongPhase = workspaceSchema.parse({ ...p3Workspace(), phase: "TESTING" });
    expect((await setup(wrongPhase).kernel.execute(propose())).error?.code).toBe("WRONG_PHASE");
    const { kernel } = setup();
    await kernel.execute(propose());
    expect((await kernel.execute({
      name: "revise_route_set", actor: "participant",
      input: { operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-other-workspace", edits: [], rejectRouteRefs: ["route-probe"] },
    })).error?.code).toBe("UNKNOWN_REF");
  });

  it("returns storage failure and leaves the last authoritative workspace intact", async () => {
    const initial = p3Workspace();
    const store = new FailingSaveStore(initial);
    const result = await new CommandKernel(store, environment()).execute(propose());
    expect(result.error?.code).toBe("STORAGE_FAILURE");
    expect(store.load()).toEqual(initial);
  });
});

class FailingSaveStore implements WorkspaceStore {
  constructor(private readonly workspace: Workspace) {}
  load(): Workspace { return workspaceSchema.parse(this.workspace); }
  save(): void { throw new WorkspaceStoreError("PERSISTENCE_FAILED", "Simulated quota failure.", 0); }
}
