import { describe, expect, it } from "vitest";
import { p3Workspace, validRoutes } from "../commands/fixtures/p3-route-set";
import { workspaceSchema } from "./workspace";

function proposedSet(ref = "route-set-valid", supersedesRouteSetRef?: string) {
  return {
    id: "00000000-0000-4000-8000-000000000601",
    ref,
    availableActions: [],
    status: "proposed" as const,
    routes: validRoutes().map((route) => ({ ...route, status: "proposed" as const })),
    createdBy: "chatgpt_webmcp" as const,
    createdAt: "2026-09-01T10:00:00.000Z",
    ...(supersedesRouteSetRef ? { supersedesRouteSetRef } : {}),
  };
}

function chosenWorkspace() {
  const initial = p3Workspace();
  const routes = validRoutes().map((route) => ({
    ...route,
    status: route.ref === "route-bridge" ? "selected" as const : "proposed" as const,
  }));
  const set = {
    ...proposedSet(),
    status: "resolved" as const,
    routes,
    selectedRouteRef: "route-bridge",
  };
  return {
    ...initial,
    phase: "TESTING" as const,
    routeProposalSets: [set],
    hypotheses: [{
      id: "00000000-0000-4000-8000-000000000602",
      ref: "hypothesis-valid",
      availableActions: [],
      status: "accepted" as const,
      claim: routes[1].premise,
      originatingRouteSetRef: set.ref,
      originatingRouteRef: routes[1].ref,
      sourceQuotes: routes[1].sourceQuotes,
      influenceFlags: [],
      confidence: 0.5,
    }],
  };
}

describe("workspace relational schema", () => {
  it("accepts a coherent selected-route and hypothesis lineage", () => {
    expect(workspaceSchema.safeParse(chosenWorkspace()).success).toBe(true);
  });

  it("rejects a ref collision with the workspace id", () => {
    const initial = p3Workspace();
    const corrupt = {
      ...initial,
      reflections: [{ ...initial.reflections[0], ref: initial.id }],
    };
    expect(workspaceSchema.safeParse(corrupt).success).toBe(false);
  });

  it("rejects operation changedRefs that do not resolve to an addressable entity", () => {
    const initial = p3Workspace();
    const corrupt = {
      ...initial,
      stateVersion: 1,
      operations: [{
        operationId: "00000000-0000-4000-8000-000000000603",
        operationRef: "operation-corrupt",
        actor: "participant" as const,
        command: "save_reflection",
        effect: "APPLIED" as const,
        beforeVersion: 0,
        afterVersion: 1,
        changedRefs: ["missing-entity"],
        at: "2026-09-01T10:00:00.000Z",
        requestIdentity: "internal",
      }],
    };
    expect(workspaceSchema.safeParse(corrupt).success).toBe(false);
  });

  it("rejects supersession lineage pointing outside prior route-set history", () => {
    const corrupt = {
      ...p3Workspace(),
      routeProposalSets: [proposedSet("route-set-new", "route-set-missing")],
    };
    expect(workspaceSchema.safeParse(corrupt).success).toBe(false);
  });

  it("rejects selectedRouteRef/cardinality disagreement", () => {
    const corrupt = chosenWorkspace();
    corrupt.routeProposalSets[0] = {
      ...corrupt.routeProposalSets[0],
      selectedRouteRef: "route-closest",
    };
    expect(workspaceSchema.safeParse(corrupt).success).toBe(false);
  });

  it("rejects an accepted hypothesis whose originating refs do not agree", () => {
    const corrupt = chosenWorkspace();
    corrupt.hypotheses[0] = {
      ...corrupt.hypotheses[0],
      originatingRouteRef: "route-probe",
    };
    expect(workspaceSchema.safeParse(corrupt).success).toBe(false);
  });
});
