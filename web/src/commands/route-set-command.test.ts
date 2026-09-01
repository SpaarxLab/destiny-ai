import { describe, expect, it } from "vitest";
import type { Command, ProposeRouteSetCommand, RouteProposalInput } from "../domain/commands";
import { workspaceSchema, type Reflection, type Workspace } from "../domain/workspace";
import { MemoryWorkspaceStore } from "../storage/memory-workspace-store";
import { WorkspaceStoreError, type WorkspaceStore } from "../storage/workspace-store";
import {
  CommandKernel,
  type CommandEnvironment,
  type CommandExecutionContext,
} from "./command-kernel";
import { p3Workspace, validRoutes } from "./fixtures/p3-route-set";

const operationOne = "00000000-0000-4000-8000-000000000011";
const operationTwo = "00000000-0000-4000-8000-000000000012";
const operationThree = "00000000-0000-4000-8000-000000000013";
const agentContext = { actor: "agent", proposalSource: "chatgpt_webmcp" } as const;
const participantContext = { actor: "participant", proposalSource: "participant" } as const;
const embeddedContext = { actor: "agent", proposalSource: "embedded_inference" } as const;

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

function proposalCommand(
  operationId = operationOne,
  expectedVersion = 0,
): ProposeRouteSetCommand {
  return {
    name: "propose_route_set",
    input: { operationId, expectedVersion, outcome: "routes", routes: validRoutes() },
  };
}

function routesOf(command: ProposeRouteSetCommand): [RouteProposalInput, RouteProposalInput, RouteProposalInput] {
  if (command.input.outcome !== "routes") throw new Error("fixture error");
  return command.input.routes as [RouteProposalInput, RouteProposalInput, RouteProposalInput];
}

function reflectionWithRef(ref: string): Reflection {
  return {
    id: `00000000-0000-4000-8000-${String(ref.length + 500).padStart(12, "0")}`,
    ref,
    availableActions: [],
    status: "confirmed",
    text: "A separate confirmed reflection for adversarial ref allocation.",
    recordedBy: "participant",
    createdAt: "2026-09-01T10:00:00.000Z",
  };
}

async function propose(
  kernel: CommandKernel,
  context: CommandExecutionContext = agentContext,
  operationId = operationOne,
  expectedVersion = 0,
) {
  return kernel.execute(context, proposalCommand(operationId, expectedVersion));
}

describe("P3A route proposal and participant choice", () => {
  it.each([
    [agentContext, "chatgpt_webmcp"],
    [participantContext, "participant"],
    [embeddedContext, "embedded_inference"],
  ] as const)("binds proposal provenance to trusted execution context", async (context, createdBy) => {
    const { store, kernel } = setup();
    const result = await propose(kernel, context);
    expect(result).toMatchObject({ ok: true, data: { outcome: "routes" }, receipt: { effect: "PROPOSED" } });
    expect(store.load().routeProposalSets[0].createdBy).toBe(createdBy);
  });

  it("rejects payload attempts to self-assert participant authority or proposal provenance", async () => {
    const { store, kernel } = setup();
    const payload = { ...proposalCommand(), actor: "participant", createdBy: "participant" };
    const result = await kernel.execute(agentContext, payload);
    expect(result.error?.code).toBe("MALFORMED_INPUT");
    expect(store.load().stateVersion).toBe(0);
  });

  it("rejects internally inconsistent adapter context at runtime", async () => {
    const { store, kernel } = setup();
    const result = await kernel.execute(
      { actor: "participant", proposalSource: "chatgpt_webmcp" } as never,
      proposalCommand(),
    );
    expect(result.error?.code).toBe("MALFORMED_INPUT");
    expect(store.load().stateVersion).toBe(0);
  });

  it("returns insufficient_signal as a receipted, visible follow-up question", async () => {
    const { store, kernel } = setup();
    const result = await kernel.execute(agentContext, {
      name: "propose_route_set",
      input: {
        operationId: operationOne,
        expectedVersion: 0,
        outcome: "insufficient_signal",
        followUpQuestion: "Which recent task felt absorbing enough to repeat?",
        reasonRefs: ["reflection-grounded"],
      },
    });
    expect(result).toMatchObject({
      ok: true,
      data: {
        outcome: "insufficient_signal",
        followUp: {
          ref: "question-1",
          status: "proposed",
          question: "Which recent task felt absorbing enough to repeat?",
          reasonRefs: ["reflection-grounded"],
          askedBy: "chatgpt_webmcp",
        },
      },
      receipt: { effect: "PROPOSED", changedRefs: ["question-1"], afterVersion: 1 },
      stateVersion: 1,
    });
    expect(result).not.toHaveProperty("error");
    expect(store.load().followUpQuestions).toHaveLength(1);
    expect(store.load().routeProposalSets).toEqual([]);
  });

  it.each([
    ["duplicate kind", (routes: ReturnType<typeof validRoutes>) => { routes[2].kind = "bridge"; }],
    ["duplicate ref", (routes: ReturnType<typeof validRoutes>) => { routes[2].ref = routes[1].ref; }],
    ["same question", (routes: ReturnType<typeof validRoutes>) => { routes[2].learningQuestion = routes[1].learningQuestion; }],
    ["same test", (routes: ReturnType<typeof validRoutes>) => { routes[2].test = routes[1].test; }],
    ["fabricated quote", (routes: ReturnType<typeof validRoutes>) => { routes[0].sourceQuotes[0].quote = "words never said"; }],
    ["cross-workspace ref", (routes: ReturnType<typeof validRoutes>) => { routes[0].sourceQuotes[0].reflectionRef = "reflection-other"; }],
    ["time cap", (routes: ReturnType<typeof validRoutes>) => { routes[0].test.maximumHours = 7; }],
    ["money cap", (routes: ReturnType<typeof validRoutes>) => { routes[0].test.maximumMoney = 101; }],
    ["currency cap", (routes: ReturnType<typeof validRoutes>) => { routes[0].test.currency = "EUR"; }],
  ] as const)("denies %s without mutation", async (_label, mutate) => {
    const { store, kernel } = setup();
    const command = proposalCommand();
    mutate(routesOf(command));
    const result = await kernel.execute(agentContext, command);
    expect(result.ok).toBe(false);
    expect(["POLICY_DENIED", "UNKNOWN_REF"]).toContain(result.error?.code);
    expect(store.load().stateVersion).toBe(0);
  });

  it.each([
    ["more than seven days", { maximumDays: 8 }],
    ["extra field", { hiddenRank: 1 }],
  ])("rejects malformed %s input before policy", async (_label, changes) => {
    const { store, kernel } = setup();
    const command = proposalCommand();
    Object.assign(routesOf(command)[0].test, changes);
    const result = await kernel.execute(agentContext, command);
    expect(result.error?.code).toBe("MALFORMED_INPUT");
    expect(store.load().stateVersion).toBe(0);
  });

  it("keeps participant-only revision and choice unavailable to agent context", async () => {
    const { kernel } = setup();
    await propose(kernel);
    expect((await kernel.execute(agentContext, {
      name: "revise_route_set",
      input: { operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1", edits: [], rejectRouteRefs: ["route-probe"] },
    })).error?.code).toBe("WRONG_ACTOR");
    expect((await kernel.execute(agentContext, {
      name: "choose_route",
      input: { operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1", routeRef: "route-closest" },
    })).error?.code).toBe("WRONG_ACTOR");
  });

  it("applies participant edits and individual rejection", async () => {
    const { store, kernel } = setup();
    await propose(kernel);
    const result = await kernel.execute(participantContext, {
      name: "revise_route_set",
      input: {
        operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1",
        edits: [{ routeRef: "route-closest", premise: "A participant-edited systems explanation direction." }],
        rejectRouteRefs: ["route-probe"],
      },
    });
    expect(result.ok).toBe(true);
    expect(store.load().routeProposalSets[0].routes.map((route) => route.status)).toEqual(["edited", "proposed", "rejected"]);
  });

  it("denies re-rejection and semantically unchanged edits without version or receipt", async () => {
    const { store, kernel } = setup();
    await propose(kernel);
    await kernel.execute(participantContext, {
      name: "revise_route_set",
      input: { operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1", edits: [], rejectRouteRefs: ["route-probe"] },
    });
    const before = store.load();
    const reReject = await kernel.execute(participantContext, {
      name: "revise_route_set",
      input: { operationId: operationThree, expectedVersion: 2, routeSetRef: "route-set-1", edits: [], rejectRouteRefs: ["route-probe"] },
    });
    expect(reReject).toMatchObject({ ok: false, error: { code: "WRONG_LIFECYCLE" }, stateVersion: 2 });
    expect(reReject).not.toHaveProperty("receipt");
    expect(store.load()).toEqual(before);

    const unchanged = await kernel.execute(participantContext, {
      name: "revise_route_set",
      input: {
        operationId: operationThree, expectedVersion: 2, routeSetRef: "route-set-1",
        edits: [{ routeRef: "route-closest", premise: validRoutes()[0].premise }], rejectRouteRefs: [],
      },
    });
    expect(unchanged.error?.code).toBe("POLICY_DENIED");
    expect(store.load()).toEqual(before);
  });

  it("preserves resolved reject-all history as explicit predecessor of a reshaped set", async () => {
    const { store, kernel } = setup();
    await propose(kernel);
    await kernel.execute(participantContext, {
      name: "revise_route_set",
      input: {
        operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1", edits: [],
        rejectRouteRefs: ["route-closest", "route-bridge", "route-probe"],
      },
    });
    const replacement = proposalCommand(operationThree, 2);
    if (replacement.input.outcome !== "routes") throw new Error("fixture error");
    replacement.input.routes = validRoutes().map((route) => ({ ...route, ref: `${route.ref}-v2` })) as typeof replacement.input.routes;
    replacement.input.supersedesRouteSetRef = "route-set-1";
    const result = await kernel.execute(agentContext, replacement);
    expect(result.ok).toBe(true);
    expect(store.load().routeProposalSets.map((set) => [set.ref, set.status, set.supersedesRouteSetRef])).toEqual([
      ["route-set-1", "resolved", undefined],
      ["route-set-3", "proposed", "route-set-1"],
    ]);
    expect(store.load().hypotheses).toEqual([]);
  });

  it("cannot supersede a live set until the participant sets a route aside", async () => {
    const { store, kernel } = setup();
    await propose(kernel);
    const replacement = proposalCommand(operationTwo, 1);
    if (replacement.input.outcome !== "routes") throw new Error("fixture error");
    replacement.input.routes = validRoutes().map((route) => ({ ...route, ref: `${route.ref}-new` })) as typeof replacement.input.routes;
    replacement.input.supersedesRouteSetRef = "route-set-1";
    const denied = await kernel.execute(agentContext, replacement);
    expect(denied).toMatchObject({ ok: false, error: { code: "POLICY_DENIED", changedRefs: ["route-set-1"] }, stateVersion: 1 });
    expect(store.load().routeProposalSets).toHaveLength(1);
  });

  it("replaces only the set-aside route, carries kept routes unchanged, and replays the replacement", async () => {
    const { store, kernel } = setup();
    await propose(kernel);
    await kernel.execute(participantContext, {
      name: "revise_route_set",
      input: {
        operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1",
        edits: [{ routeRef: "route-closest", title: "Edited by the participant" }],
        rejectRouteRefs: ["route-probe"],
      },
    });
    const probe = { ...validRoutes()[2], ref: "route-probe-new", title: "A different probe", learningQuestion: "Does a new probe teach something distinct?" };
    const replacement: ProposeRouteSetCommand = {
      name: "propose_route_set",
      input: {
        operationId: operationThree, expectedVersion: 2, outcome: "routes",
        supersedesRouteSetRef: "route-set-1",
        routes: [{ carryRouteRef: "route-closest" }, { carryRouteRef: "route-bridge" }, probe],
      },
    };
    const first = await kernel.execute(agentContext, replacement);
    expect(first).toMatchObject({
      ok: true,
      receipt: { effect: "PROPOSED", changedRefs: ["route-set-1", "route-set-3"] },
      stateVersion: 3,
    });
    if (first.data?.outcome !== "routes") throw new Error("expected routes");
    expect(first.data.routeSet.routes.map((route) => [route.ref, route.status, route.carriedFromRouteRef])).toEqual([
      ["route-closest-v2", "edited", "route-closest"],
      ["route-bridge-v2", "proposed", "route-bridge"],
      ["route-probe-new", "proposed", undefined],
    ]);
    expect(first.data.routeSet.routes[0].title).toBe("Edited by the participant");
    expect(store.load().routeProposalSets.map((set) => set.status)).toEqual(["superseded", "proposed"]);

    const replay = await kernel.execute(agentContext, { ...replacement, input: { ...replacement.input, expectedVersion: 3 } });
    expect(replay.ok).toBe(true);
    if (replay.data?.outcome !== "routes") throw new Error("expected routes replay");
    expect(replay.data.routeSet.ref).toBe("route-set-3");
    expect(replay.receipt).toEqual(first.receipt);
    expect(store.load().routeProposalSets).toHaveLength(2);
  });

  it.each([
    ["a missing carry of a kept route", (routes: unknown[]) => { routes.splice(0, 1, { ...validRoutes()[0], ref: "route-closest-new" }); }, "route-closest"],
    ["carrying the set-aside route", (routes: unknown[]) => { routes.splice(2, 1, { carryRouteRef: "route-probe" }); }, "route-probe"],
    ["a replacement of the wrong kind", (routes: unknown[]) => { routes.splice(2, 1, { ...validRoutes()[1], ref: "route-bridge-new" }); }, "kinds"],
  ])("denies %s during live supersession", async (_label, mutate, expectedFragment) => {
    const { store, kernel } = setup();
    await propose(kernel);
    await kernel.execute(participantContext, {
      name: "revise_route_set",
      input: { operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1", rejectRouteRefs: ["route-probe"] },
    });
    const routes: unknown[] = [{ carryRouteRef: "route-closest" }, { carryRouteRef: "route-bridge" }, { ...validRoutes()[2], ref: "route-probe-new" }];
    mutate(routes);
    const result = await kernel.execute(agentContext, {
      name: "propose_route_set",
      input: { operationId: operationThree, expectedVersion: 2, outcome: "routes", supersedesRouteSetRef: "route-set-1", routes },
    });
    expect(result.ok).toBe(false);
    expect(["POLICY_DENIED", "MALFORMED_INPUT"]).toContain(result.error?.code);
    expect(result.error?.what).toContain(expectedFragment);
    expect(store.load().stateVersion).toBe(2);
  });

  it("denies carryRouteRef when there is no live predecessor", async () => {
    const { store, kernel } = setup();
    const result = await kernel.execute(agentContext, {
      name: "propose_route_set",
      input: { operationId: operationOne, expectedVersion: 0, outcome: "routes", routes: [{ carryRouteRef: "route-closest" }, validRoutes()[1], validRoutes()[2]] },
    });
    expect(result).toMatchObject({ ok: false, error: { code: "POLICY_DENIED" }, stateVersion: 0 });
    expect(store.load().routeProposalSets).toEqual([]);
  });

  it.each([false, true])("chooses one route with finalEdit=%s and replays both result refs", async (withEdit) => {
    const { store, kernel } = setup();
    await propose(kernel);
    const command: Extract<Command, { name: "choose_route" }> = {
      name: "choose_route",
      input: {
        operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1", routeRef: "route-bridge",
        ...(withEdit ? { finalEdit: { routeRef: "route-bridge", premise: "The final participant-edited bridge claim." } } : {}),
      },
    };
    const first = await kernel.execute(participantContext, command);
    const replay = await kernel.execute(participantContext, { ...command, input: { ...command.input, expectedVersion: 2 } });
    expect(replay.ok).toBe(true);
    expect(replay.data?.routeSet.ref).toBe("route-set-1");
    expect(replay.data?.hypothesis.ref).toBe("hypothesis-2");
    expect(replay.receipt).toEqual(first.receipt);
    expect(store.load().phase).toBe("TESTING");
    expect(store.load().hypotheses).toHaveLength(1);
  });

  it("returns stale denial and same-id conflict without duplicate effects", async () => {
    const { store, kernel } = setup();
    await propose(kernel);
    expect((await propose(kernel, agentContext, operationTwo, 0)).error?.code).toBe("STALE_STATE");
    const conflict = proposalCommand(operationOne, 1);
    routesOf(conflict)[0].title = "Different intent";
    expect((await kernel.execute(agentContext, conflict)).error?.code).toBe("OPERATION_CONFLICT");
    expect(store.load().operations).toHaveLength(1);
  });

  it("binds replay identity to trusted actor and proposal provenance", async () => {
    const { store, kernel } = setup();
    await propose(kernel, agentContext);
    expect((await propose(kernel, embeddedContext, operationOne, 1)).error?.code)
      .toBe("OPERATION_CONFLICT");
    expect((await propose(kernel, participantContext, operationOne, 1)).error?.code)
      .toBe("OPERATION_CONFLICT");
    expect(store.load().operations).toHaveLength(1);
  });

  it("allocates generated refs around all workspace addressable refs", async () => {
    const initial = p3Workspace();
    const collisionState = workspaceSchema.parse({
      ...initial,
      reflections: [
        ...initial.reflections,
        reflectionWithRef("route-set-1"),
        reflectionWithRef("operation-1"),
        reflectionWithRef("hypothesis-2"),
      ],
    });
    const { store, kernel } = setup(collisionState);
    const proposed = await propose(kernel);
    expect(proposed.data?.outcome).toBe("routes");
    if (proposed.data?.outcome !== "routes") throw new Error("expected routes");
    expect(proposed.data.routeSet.ref).toBe("route-set-1-2");
    expect(proposed.receipt?.operationRef).toBe("operation-1-2");
    const chosen = await kernel.execute(participantContext, {
      name: "choose_route",
      input: { operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1-2", routeRef: "route-bridge" },
    });
    expect(chosen.data?.hypothesis.ref).toBe("hypothesis-2-2");
    expect(store.load().hypotheses).toHaveLength(1);
  });

  it("allocates the receipt ref around a route ref supplied by the same command", async () => {
    const { store, kernel } = setup();
    const command = proposalCommand();
    routesOf(command)[0].ref = "operation-1";
    const result = await kernel.execute(agentContext, command);
    expect(result.ok).toBe(true);
    expect(result.receipt?.operationRef).toBe("operation-1-2");
    expect(store.load().routeProposalSets[0].routes[0].ref).toBe("operation-1");
  });

  it("denies supplied route refs that collide with workspace id, entities, or operation refs", async () => {
    const initial = p3Workspace();
    const withOperation = workspaceSchema.parse({
      ...initial,
      stateVersion: 1,
      operations: [{
        operationId: "00000000-0000-4000-8000-000000000099",
        operationRef: "occupied-operation-ref",
        actor: "participant",
        command: "save_reflection",
        effect: "APPLIED",
        beforeVersion: 0,
        afterVersion: 1,
        changedRefs: ["reflection-grounded"],
        at: "2026-09-01T10:00:00.000Z",
        requestIdentity: "internal-test",
      }],
    });
    for (const collision of [withOperation.id, "reflection-grounded", "occupied-operation-ref"]) {
      const { store, kernel } = setup(withOperation);
      const command = proposalCommand(operationOne, 1);
      routesOf(command)[0].ref = collision;
      expect((await kernel.execute(agentContext, command)).error?.code).toBe("POLICY_DENIED");
      expect(store.load().stateVersion).toBe(1);
    }
  });

  it("compensates only an untouched proposal and preserves receipt history", async () => {
    const { store, kernel } = setup();
    await propose(kernel);
    const result = await kernel.execute(participantContext, {
      name: "compensate_route_set",
      input: { operationId: operationTwo, expectedVersion: 1, routeSetRef: "route-set-1" },
    });
    expect(result).toMatchObject({ ok: true, receipt: { effect: "COMPENSATED", compensatesOperationRef: "operation-1" } });
    expect(store.load().routeProposalSets[0].status).toBe("resolved");
    expect(store.load().operations).toHaveLength(2);
  });

  it("returns storage failure and leaves the authoritative workspace intact", async () => {
    const initial = p3Workspace();
    const store = new FailingSaveStore(initial);
    const result = await propose(new CommandKernel(store, environment()));
    expect(result.error?.code).toBe("STORAGE_FAILURE");
    expect(store.load()).toEqual(initial);
  });
});

class FailingSaveStore implements WorkspaceStore {
  constructor(private readonly workspace: Workspace) {}
  load(): Workspace { return workspaceSchema.parse(this.workspace); }
  save(): void { throw new WorkspaceStoreError("PERSISTENCE_FAILED", "Simulated quota failure.", 0); }
}
