import { describe, expect, it } from "vitest";
import { p3Workspace, validRoutes } from "../commands/fixtures/p3-route-set";
import { workspaceSchema, type OperationRecord } from "./workspace";

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

function operation(index: number, overrides: Partial<OperationRecord> = {}): OperationRecord {
  return {
    operationId: `00000000-0000-4000-8000-${String(index + 610).padStart(12, "0")}`,
    operationRef: `operation-ledger-${index + 1}`,
    actor: "participant" as const,
    command: "save_reflection",
    effect: "APPLIED" as const,
    beforeVersion: index,
    afterVersion: index + 1,
    changedRefs: ["reflection-grounded"],
    at: "2026-09-01T10:00:00.000Z",
    requestIdentity: `internal-${index + 1}`,
    ...overrides,
  };
}

function compensatedWorkspace() {
  const set = { ...proposedSet(), status: "resolved" as const };
  const proposal = operation(0, {
    operationRef: "operation-proposal",
    command: "propose_route_set",
    effect: "PROPOSED",
    changedRefs: [set.ref],
  });
  const compensation = operation(1, {
    operationRef: "operation-compensation",
    command: "compensate_route_set",
    effect: "COMPENSATED",
    changedRefs: [set.ref],
    compensatesOperationRef: proposal.operationRef,
  });
  return {
    ...p3Workspace(),
    stateVersion: 2,
    routeProposalSets: [set],
    operations: [proposal, compensation],
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

  it("accepts one correctly bound compensation ledger", () => {
    expect(workspaceSchema.safeParse(compensatedWorkspace()).success).toBe(true);
  });

  it("rejects duplicate operation ids and a broken version chain", () => {
    const initial = p3Workspace();
    const first = operation(0);
    const duplicateAndBroken = operation(1, {
      operationId: first.operationId,
      beforeVersion: 4,
      afterVersion: 5,
    });
    const corrupt = {
      ...initial,
      stateVersion: 5,
      operations: [first, duplicateAndBroken],
    };
    expect(workspaceSchema.safeParse(corrupt).success).toBe(false);
  });

  it("rejects a ledger whose final version differs from workspace stateVersion", () => {
    const corrupt = { ...p3Workspace(), stateVersion: 2, operations: [operation(0)] };
    expect(workspaceSchema.safeParse(corrupt).success).toBe(false);
  });

  it("rejects missing, future, wrong, and duplicate compensation targets", () => {
    const missing = compensatedWorkspace();
    missing.operations[1] = { ...missing.operations[1], compensatesOperationRef: undefined };
    expect(workspaceSchema.safeParse(missing).success).toBe(false);

    const future = compensatedWorkspace();
    future.stateVersion = 3;
    future.operations = [
      operation(0),
      operation(1, {
        operationRef: "operation-compensation",
        command: "compensate_route_set",
        effect: "COMPENSATED",
        changedRefs: [future.routeProposalSets[0].ref],
        compensatesOperationRef: "operation-future",
      }),
      operation(2, {
        operationRef: "operation-future",
        command: "propose_route_set",
        effect: "PROPOSED",
        changedRefs: [future.routeProposalSets[0].ref],
      }),
    ];
    expect(workspaceSchema.safeParse(future).success).toBe(false);

    const wrong = compensatedWorkspace();
    wrong.operations = [
      operation(0, { operationRef: "operation-wrong" }),
      { ...wrong.operations[1], compensatesOperationRef: "operation-wrong" },
    ];
    expect(workspaceSchema.safeParse(wrong).success).toBe(false);

    const duplicate = compensatedWorkspace();
    duplicate.stateVersion = 3;
    duplicate.operations.push(operation(2, {
      operationRef: "operation-compensation-2",
      command: "compensate_route_set",
      effect: "COMPENSATED",
      changedRefs: [duplicate.routeProposalSets[0].ref],
      compensatesOperationRef: "operation-proposal",
    }));
    expect(workspaceSchema.safeParse(duplicate).success).toBe(false);
  });

  it("rejects compensation of a proposal after an intervening change to its route set", () => {
    const corrupt = compensatedWorkspace();
    const proposal = corrupt.operations[0];
    corrupt.stateVersion = 3;
    corrupt.operations = [
      proposal,
      operation(1, {
        operationRef: "operation-intervening-revision",
        command: "revise_route_set",
        effect: "APPLIED",
        changedRefs: [corrupt.routeProposalSets[0].ref],
      }),
      operation(2, {
        operationRef: "operation-late-compensation",
        command: "compensate_route_set",
        effect: "COMPENSATED",
        changedRefs: [corrupt.routeProposalSets[0].ref],
        compensatesOperationRef: proposal.operationRef,
      }),
    ];

    expect(workspaceSchema.safeParse(corrupt).success).toBe(false);
  });

  it.each([
    ["hours", { maximumHours: 7 }],
    ["money", { maximumMoney: 101 }],
    ["currency", { currency: "EUR" }],
  ])("rejects stored route tests outside participant %s caps", (_label, testChange) => {
    const set = proposedSet();
    set.routes[0] = { ...set.routes[0], test: { ...set.routes[0].test, ...testChange } };
    expect(workspaceSchema.safeParse({ ...p3Workspace(), routeProposalSets: [set] }).success)
      .toBe(false);
  });

  it("rejects a proposed set whose routes are all rejected", () => {
    const set = proposedSet();
    const allRejected = {
      ...set,
      routes: set.routes.map((route) => ({ ...route, status: "rejected" as const })),
    };
    expect(workspaceSchema.safeParse({ ...p3Workspace(), routeProposalSets: [allRejected] }).success)
      .toBe(false);
  });
});
