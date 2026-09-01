import { describe, expect, it } from "vitest";
import { z } from "zod";
import { p3Workspace, validRoutes } from "../../commands/fixtures/p3-route-set";
import { proposeRouteSetInputSchema } from "../../domain/commands";
import { workspaceSchema } from "../../domain/workspace";
import { PROPOSE_ROUTE_SET_INPUT_SCHEMA } from "../catalogue/propose-route-set-schema";
import { createProviderOffEvalContext, invokeOnlyIfAvailable } from "./provider-off-harness";

const operationId = "00000000-0000-4000-8000-000000008001";

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
    expect(context.runtime.activeToolNames()).not.toContain("choose_route");
    expect(context.runtime.activeToolNames()).not.toContain("revise_route_set");
    expect(context.runtime.latest("propose_route_set").annotations).toEqual({
      readOnlyHint: false,
      untrustedContentHint: true,
    });
    expect(context.runtime.latest("propose_route_set").description).toContain(
      "the participant alone may edit, reject, or choose a route",
    );
  });

  it("mechanically derives the wire schema from the canonical P3A Zod schema", async () => {
    const mechanicallyDerived = z.toJSONSchema(proposeRouteSetInputSchema, {
      target: "draft-7",
      io: "input",
      unrepresentable: "throw",
    });
    expect(PROPOSE_ROUTE_SET_INPUT_SCHEMA).toEqual(mechanicallyDerived);
    expectAllObjectSchemasAreStrict(PROPOSE_ROUTE_SET_INPUT_SCHEMA);

    const context = createProviderOffEvalContext(p3Workspace());
    await context.discover();
    expect(context.runtime.latest("propose_route_set").inputSchema).toEqual(mechanicallyDerived);
  });

  it("filters the write tool when phase or lifecycle makes it unavailable", async () => {
    const wrongPhase = createProviderOffEvalContext(workspaceSchema.parse({
      ...p3Workspace(),
      phase: "TESTING",
    }));
    await wrongPhase.discover();
    expect(wrongPhase.runtime.activeToolNames()).toEqual([
      "read_workspace",
      "get_method_guide",
    ]);
    await expect(invokeOnlyIfAvailable(
      wrongPhase.runtime,
      "propose_route_set",
      { operationId, expectedVersion: 0, outcome: "routes", routes: validRoutes() },
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
    ]);
    await expect(invokeOnlyIfAvailable(
      unresolved.runtime,
      "propose_route_set",
      { operationId: "00000000-0000-4000-8000-000000008002" },
    )).resolves.toEqual({ invoked: false });
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
