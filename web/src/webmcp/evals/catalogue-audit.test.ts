import { describe, expect, it } from "vitest";
import { z } from "zod";
import { p3Workspace, validRoutes } from "../../commands/fixtures/p3-route-set";
import { proposeRouteSetInputSchema } from "../../domain/commands";
import { workspaceSchema } from "../../domain/workspace";
import { PROPOSE_ROUTE_SET_INPUT_SCHEMA } from "../catalogue/propose-route-set-schema";
import { PROPOSE_ROUTE_SET_DESCRIPTION } from "../tools/propose-route-set";
import { createProviderOffEvalContext, invokeOnlyIfAvailable } from "./provider-off-harness";

const operationId = "00000000-0000-4000-8000-000000008001";
const NEVER_IMPERATIVE = [
  "choose_route", "revise_route_set", "compensate_route_set", "set_limits", "skip_follow_up",
  "reopen_exploring", "save_reflection",
];

describe("P8B WebMCP catalogue audit", () => {
  it("registers the exact competition catalogue and never exposes participant-only commands", async () => {
    const context = createProviderOffEvalContext(p3Workspace());

    await expect(context.discover()).resolves.toEqual({
      status: "registered",
      toolNames: ["read_workspace", "get_method_guide", "propose_route_set"],
    });
    expect(context.runtime.activeToolNames()).toEqual([
      "read_workspace",
      "get_method_guide",
      "propose_route_set",
    ]);
    for (const name of NEVER_IMPERATIVE) {
      expect(context.runtime.activeToolNames()).not.toContain(name);
    }
    expect(context.runtime.latest("propose_route_set").annotations).toEqual({
      readOnlyHint: false,
      untrustedContentHint: true,
    });
    for (const rule of ["exact substring", "focus.costCaps", "distinct learningQuestion", "fresh route refs", "supersedesRouteSetRef", "carryRouteRef", "insufficient_signal"]) {
      expect(PROPOSE_ROUTE_SET_DESCRIPTION).toContain(rule);
    }
    expect(context.runtime.latest("propose_route_set").description).toContain(
      "The participant alone may edit, set aside, choose, answer, or skip",
    );
  });

  it("advertises in read projections only actions that are registered as tools", async () => {
    for (const workspace of [p3Workspace(), workspaceSchema.parse({ ...p3Workspace(), reflections: [] })]) {
      const context = createProviderOffEvalContext(workspace);
      await context.discover();
      const read = await context.runtime.invoke("read_workspace", { view: "orientation" }) as {
        nextActions: { tool: string; actor: string }[];
        data: { availableActions: { tool: string; actor: string }[] };
      };
      const registered = context.runtime.activeToolNames();
      for (const action of [...read.nextActions, ...read.data.availableActions]) {
        expect(action.actor).toBe("agent");
        expect(registered).toContain(action.tool);
      }
    }
  });

  it("mechanically derives the wire schema from the canonical P3A Zod schema", async () => {
    const mechanicallyDerived = z.toJSONSchema(proposeRouteSetInputSchema, {
      target: "draft-7",
      io: "input",
      unrepresentable: "throw",
    });
    expect(PROPOSE_ROUTE_SET_INPUT_SCHEMA).toEqual(mechanicallyDerived);
    expectAllObjectSchemasAreStrict(PROPOSE_ROUTE_SET_INPUT_SCHEMA);
    expect(JSON.stringify(PROPOSE_ROUTE_SET_INPUT_SCHEMA)).toContain("carryRouteRef");

    const context = createProviderOffEvalContext(p3Workspace());
    await context.discover();
    expect(context.runtime.latest("propose_route_set").inputSchema).toEqual(mechanicallyDerived);
  });

  it("filters the write tool when phase or lifecycle makes it unavailable", async () => {
    // TESTING requires an accepted hypothesis; reach it through the real participant command.
    const wrongPhase = createProviderOffEvalContext(p3Workspace());
    await wrongPhase.discover();
    await wrongPhase.runtime.invoke("propose_route_set", {
      operationId, expectedVersion: 0, outcome: "routes", routes: validRoutes(),
    });
    const chosen = await wrongPhase.participant({
      name: "choose_route",
      input: { operationId: "00000000-0000-4000-8000-000000008003", expectedVersion: 1, routeSetRef: "route-set-1", routeRef: "route-closest" },
    });
    expect(chosen.ok).toBe(true);
    expect(wrongPhase.store.load().phase).toBe("TESTING");
    await wrongPhase.discover();
    expect(wrongPhase.runtime.activeToolNames()).toEqual([
      "read_workspace",
      "get_method_guide",
    ]);
    await expect(invokeOnlyIfAvailable(
      wrongPhase.runtime,
      "propose_route_set",
      { operationId, expectedVersion: 2, outcome: "routes", routes: validRoutes() },
    )).resolves.toEqual({ invoked: false });

    const unresolved = createProviderOffEvalContext(p3Workspace());
    await unresolved.discover();
    await unresolved.runtime.invoke("propose_route_set", {
      operationId,
      expectedVersion: 0,
      outcome: "routes",
      routes: validRoutes(),
    });
    await unresolved.discover();
    expect(unresolved.runtime.activeToolNames()).toEqual([
      "read_workspace",
      "get_method_guide",
      "propose_route_set",
    ]);
    const deniedNewProposal = await invokeOnlyIfAvailable(
      unresolved.runtime,
      "propose_route_set",
      {
        operationId: "00000000-0000-4000-8000-000000008002",
        expectedVersion: 1,
        outcome: "routes",
        routes: validRoutes().map((route) => ({ ...route, ref: `${route.ref}-x` })),
        supersedesRouteSetRef: "route-set-1",
      },
    );
    expect(deniedNewProposal).toMatchObject({
      invoked: true,
      result: { ok: false, error: { code: "POLICY_DENIED" }, stateVersion: 1 },
    });
    expect(unresolved.store.load().routeProposalSets).toHaveLength(1);
    expect(unresolved.activity.at(-1)).toMatchObject({
      tool: "propose_route_set",
      outcome: "denied",
      summary: expect.stringContaining("Nothing changed"),
    });
  });
});

function expectAllObjectSchemasAreStrict(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(expectAllObjectSchemasAreStrict);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const schema = value as Record<string, unknown>;
  if (schema.type === "object") expect(schema.additionalProperties).toBe(false);
  Object.values(schema).forEach(expectAllObjectSchemasAreStrict);
}
