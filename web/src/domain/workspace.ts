import { z } from "zod";

export const WORKSPACE_SCHEMA_VERSION = 2;
export const CONTRACT_VERSION = "1.1.0";

const refSchema = z.string().trim().min(1).max(128);
const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const phaseSchema = z.enum(["EXPLORING", "TESTING", "REVIEWING"]);
export type Phase = z.infer<typeof phaseSchema>;

export const actorSchema = z.enum(["participant", "agent"]);
export type Actor = z.infer<typeof actorSchema>;

export const availableActionSchema = z.strictObject({
  tool: z.string().min(1).max(64),
  targetRef: refSchema,
  actor: actorSchema,
  effect: z.enum(["READ", "PREPARE_UI", "PROPOSE"]),
  requiresHuman: z.boolean(),
  reason: z.string().min(1).max(240).optional(),
});
export type AvailableAction = z.infer<typeof availableActionSchema>;

export const reflectionSchema = z.strictObject({
  id: z.string().uuid(),
  ref: refSchema,
  availableActions: z.array(availableActionSchema),
  status: z.enum(["proposed", "confirmed"]),
  text: z.string().min(1).max(2_000),
  recordedBy: z.enum(["participant", "agent_transcribed"]),
  createdAt: z.string().datetime({ offset: true }),
});
export type Reflection = z.infer<typeof reflectionSchema>;

export const quoteSourceSchema = z.strictObject({
  reflectionRef: refSchema,
  quote: boundedText(500),
});
export type QuoteSource = z.infer<typeof quoteSourceSchema>;

export const routeKindSchema = z.enum(["closest", "bridge", "probe"]);
export type RouteKind = z.infer<typeof routeKindSchema>;

export const routeTestSchema = z.strictObject({
  action: boundedText(500),
  maximumDays: z.number().int().min(1).max(7),
  maximumHours: z.number().nonnegative(),
  maximumMoney: z.number().nonnegative(),
  currency: z.string().length(3),
});
export type RouteTest = z.infer<typeof routeTestSchema>;

export const routePreviewSchema = z.strictObject({
  ref: refSchema,
  kind: routeKindSchema,
  title: boundedText(120),
  premise: boundedText(600),
  sourceQuotes: z.array(quoteSourceSchema).min(1).max(5),
  constraint: boundedText(300),
  learningQuestion: boundedText(300),
  test: routeTestSchema,
  strengthensWhen: boundedText(300),
  weakensWhen: boundedText(300),
  status: z.enum(["proposed", "edited", "rejected", "selected"]),
});
export type RoutePreview = z.infer<typeof routePreviewSchema>;

export const routeProposalSetSchema = z.strictObject({
  id: z.string().uuid(),
  ref: refSchema,
  availableActions: z.array(availableActionSchema),
  status: z.enum(["proposed", "resolved", "superseded"]),
  routes: z.tuple([routePreviewSchema, routePreviewSchema, routePreviewSchema]),
  selectedRouteRef: refSchema.optional(),
  supersedesRouteSetRef: refSchema.optional(),
  createdBy: z.enum(["chatgpt_webmcp", "participant", "embedded_inference"]),
  createdAt: z.string().datetime({ offset: true }),
});
export type RouteProposalSet = z.infer<typeof routeProposalSetSchema>;

export const hypothesisSchema = z.strictObject({
  id: z.string().uuid(),
  ref: refSchema,
  availableActions: z.array(availableActionSchema),
  status: z.enum([
    "proposed", "accepted", "rejected", "superseded", "testing",
    "supported", "weakened", "refuted", "parked",
  ]),
  claim: boundedText(600),
  originatingRouteSetRef: refSchema,
  originatingRouteRef: refSchema,
  sourceQuotes: z.array(quoteSourceSchema).min(1).max(5),
  influenceFlags: z.array(z.enum(["peer", "trend", "parent", "prestige", "fear"])).max(5),
  confidence: z.number().min(0).max(1),
});
export type Hypothesis = z.infer<typeof hypothesisSchema>;

export const operationReceiptSchema = z.strictObject({
  operationId: z.string().uuid(),
  operationRef: refSchema,
  actor: actorSchema,
  command: z.string().min(1).max(64),
  effect: z.enum(["APPLIED", "PROPOSED", "AWAITING_HUMAN", "COMPENSATED"]),
  beforeVersion: z.number().int().nonnegative(),
  afterVersion: z.number().int().nonnegative(),
  changedRefs: z.array(refSchema),
  at: z.string().datetime({ offset: true }),
  compensatesOperationRef: refSchema.optional(),
});
export type OperationReceipt = z.infer<typeof operationReceiptSchema>;

export const operationRecordSchema = operationReceiptSchema.extend({
  requestIdentity: z.string().min(1),
});
export type OperationRecord = z.infer<typeof operationRecordSchema>;

export const participantSchema = z.strictObject({
  displayName: z.string().max(120),
  focusQuestion: z.string().max(500),
  costCaps: z.strictObject({
    hoursPerWeek: z.number().nonnegative(),
    money: z.number().nonnegative(),
    currency: z.string().length(3),
  }),
});

const notImplementedCollectionSchema = z.array(z.never()).length(0);

const workspaceObjectSchema = z.strictObject({
  id: z.string().uuid(),
  schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
  contractVersion: z.literal(CONTRACT_VERSION),
  stateVersion: z.number().int().nonnegative(),
  phase: phaseSchema,
  participant: participantSchema,
  reflections: z.array(reflectionSchema),
  routeProposalSets: z.array(routeProposalSetSchema),
  hypotheses: z.array(hypothesisSchema),
  experiments: notImplementedCollectionSchema,
  evidence: notImplementedCollectionSchema,
  revisions: notImplementedCollectionSchema,
  planItems: notImplementedCollectionSchema,
  outbox: notImplementedCollectionSchema,
  teachings: notImplementedCollectionSchema,
  operations: z.array(operationRecordSchema),
});

export const workspaceSchema = workspaceObjectSchema.superRefine((workspace, context) => {
  const addressableRefs = [
    { ref: workspace.id, path: ["id"] },
    ...workspace.reflections.map((entity, index) => ({ ref: entity.ref, path: ["reflections", index, "ref"] })),
    ...workspace.routeProposalSets.map((entity, index) => ({ ref: entity.ref, path: ["routeProposalSets", index, "ref"] })),
    ...workspace.routeProposalSets.flatMap((set, setIndex) =>
      set.routes.map((route, routeIndex) => ({
        ref: route.ref,
        path: ["routeProposalSets", setIndex, "routes", routeIndex, "ref"],
      }))),
    ...workspace.hypotheses.map((entity, index) => ({ ref: entity.ref, path: ["hypotheses", index, "ref"] })),
    ...workspace.operations.map((entity, index) => ({ ref: entity.operationRef, path: ["operations", index, "operationRef"] })),
  ];
  const seen = new Set<string>();
  for (const entry of addressableRefs) {
    if (seen.has(entry.ref)) {
      context.addIssue({ code: "custom", path: entry.path, message: `Addressable ref ${entry.ref} is not unique.` });
    }
    seen.add(entry.ref);
  }
  for (const [operationIndex, operation] of workspace.operations.entries()) {
    for (const [changedRefIndex, changedRef] of operation.changedRefs.entries()) {
      if (!seen.has(changedRef)) {
        context.addIssue({
          code: "custom",
          path: ["operations", operationIndex, "changedRefs", changedRefIndex],
          message: `Changed ref ${changedRef} does not point to an addressable workspace entity.`,
        });
      }
    }
  }

  const operationIds = new Set<string>();
  const compensatedTargets = new Set<string>();
  let expectedBeforeVersion = 0;
  for (const [operationIndex, operation] of workspace.operations.entries()) {
    if (operationIds.has(operation.operationId)) {
      context.addIssue({
        code: "custom",
        path: ["operations", operationIndex, "operationId"],
        message: `Operation id ${operation.operationId} is not unique.`,
      });
    }
    operationIds.add(operation.operationId);

    if (
      operation.beforeVersion !== expectedBeforeVersion ||
      operation.afterVersion !== operation.beforeVersion + 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["operations", operationIndex],
        message: "Operation versions must form an ordered contiguous chain.",
      });
    }
    expectedBeforeVersion = operation.afterVersion;

    const compensationRef = operation.compensatesOperationRef;
    if (compensationRef === undefined) {
      if (operation.effect === "COMPENSATED" || operation.command === "compensate_route_set") {
        context.addIssue({
          code: "custom",
          path: ["operations", operationIndex, "compensatesOperationRef"],
          message: "A compensating route-set operation must name its target proposal operation.",
        });
      }
      continue;
    }

    if (operation.effect !== "COMPENSATED" || operation.command !== "compensate_route_set") {
      context.addIssue({
        code: "custom",
        path: ["operations", operationIndex, "compensatesOperationRef"],
        message: "Only a COMPENSATED compensate_route_set operation may carry a compensation ref.",
      });
    }
    const targetIndex = workspace.operations.findIndex(
      (candidate) => candidate.operationRef === compensationRef,
    );
    const target = workspace.operations[targetIndex];
    if (targetIndex < 0 || targetIndex >= operationIndex) {
      context.addIssue({
        code: "custom",
        path: ["operations", operationIndex, "compensatesOperationRef"],
        message: "A compensation target must be an earlier existing operation.",
      });
      continue;
    }
    if (
      target.command !== "propose_route_set" || target.effect !== "PROPOSED" ||
      target.changedRefs.at(-1) !== operation.changedRefs[0] || operation.changedRefs.length !== 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["operations", operationIndex, "compensatesOperationRef"],
        message: "Compensation must target a PROPOSED route-set operation for the same route set.",
      });
    }
    const targetRouteSetRef = target.changedRefs.at(-1);
    const interveningChange = targetRouteSetRef !== undefined && workspace.operations
      .slice(targetIndex + 1, operationIndex)
      .some((candidate) => candidate.changedRefs.includes(targetRouteSetRef));
    if (interveningChange) {
      context.addIssue({
        code: "custom",
        path: ["operations", operationIndex, "compensatesOperationRef"],
        message: "A route-set proposal cannot be compensated after an intervening change to that set.",
      });
    }
    if (compensatedTargets.has(compensationRef)) {
      context.addIssue({
        code: "custom",
        path: ["operations", operationIndex, "compensatesOperationRef"],
        message: "A route-set proposal operation may be compensated only once.",
      });
    }
    compensatedTargets.add(compensationRef);
  }
  if (expectedBeforeVersion !== workspace.stateVersion) {
    context.addIssue({
      code: "custom",
      path: ["stateVersion"],
      message: "Workspace stateVersion must equal the end of its contiguous operation ledger.",
    });
  }

  for (const [setIndex, set] of workspace.routeProposalSets.entries()) {
    if (set.supersedesRouteSetRef) {
      const targetIndex = workspace.routeProposalSets.findIndex(
        (candidate) => candidate.ref === set.supersedesRouteSetRef,
      );
      if (targetIndex < 0 || targetIndex >= setIndex) {
        context.addIssue({
          code: "custom",
          path: ["routeProposalSets", setIndex, "supersedesRouteSetRef"],
          message: "A supersession target must be an earlier route set in this workspace.",
        });
      }
    }

    const selected = set.routes.filter((route) => route.status === "selected");
    if (set.selectedRouteRef === undefined) {
      if (selected.length !== 0) {
        context.addIssue({ code: "custom", path: ["routeProposalSets", setIndex, "routes"], message: "Selected routes require selectedRouteRef." });
      }
    } else if (
      set.status !== "resolved" ||
      selected.length !== 1 ||
      selected[0]?.ref !== set.selectedRouteRef
    ) {
      context.addIssue({
        code: "custom",
        path: ["routeProposalSets", setIndex, "selectedRouteRef"],
        message: "A resolved selected set must point to exactly one selected route.",
      });
    }
    if (set.status !== "resolved" && set.selectedRouteRef !== undefined) {
      context.addIssue({ code: "custom", path: ["routeProposalSets", setIndex, "status"], message: "Only a resolved set may have a selected route." });
    }
    if (set.status === "proposed" && set.routes.every((route) => route.status === "rejected")) {
      context.addIssue({
        code: "custom",
        path: ["routeProposalSets", setIndex, "status"],
        message: "A proposed route set must retain at least one non-rejected route.",
      });
    }
    if (set.status === "resolved" && set.selectedRouteRef === undefined) {
      const allRejected = set.routes.every((route) => route.status === "rejected");
      const compensated = workspace.operations.some(
        (operation) => operation.effect === "COMPENSATED" && operation.changedRefs.includes(set.ref),
      );
      if (!allRejected && !compensated) {
        context.addIssue({
          code: "custom",
          path: ["routeProposalSets", setIndex, "status"],
          message: "A resolved unselected set must be all-rejected or have a compensation receipt.",
        });
      }
    }

    const kinds = new Set(set.routes.map((route) => route.kind));
    const questions = new Set(set.routes.map((route) => route.learningQuestion));
    const tests = new Set(set.routes.map((route) => JSON.stringify(route.test)));
    if (kinds.size !== 3 || questions.size !== 3 || tests.size !== 3) {
      context.addIssue({
        code: "custom",
        path: ["routeProposalSets", setIndex, "routes"],
        message: "Stored routes must retain unique kinds, learning questions, and tests.",
      });
    }
    for (const [routeIndex, route] of set.routes.entries()) {
      if (
        route.test.maximumHours > workspace.participant.costCaps.hoursPerWeek ||
        route.test.maximumMoney > workspace.participant.costCaps.money ||
        route.test.currency !== workspace.participant.costCaps.currency
      ) {
        context.addIssue({
          code: "custom",
          path: ["routeProposalSets", setIndex, "routes", routeIndex, "test"],
          message: "Stored route tests must stay within participant time, money, and currency caps.",
        });
      }
      for (const source of route.sourceQuotes) {
        const reflection = workspace.reflections.find(
          (candidate) => candidate.ref === source.reflectionRef,
        );
        if (!reflection || reflection.status !== "confirmed" || !reflection.text.includes(source.quote)) {
          context.addIssue({
            code: "custom",
            path: ["routeProposalSets", setIndex, "routes", routeIndex, "sourceQuotes"],
            message: "Stored route quotes must exactly cite confirmed reflections.",
          });
        }
      }
    }
  }

  for (const [hypothesisIndex, hypothesis] of workspace.hypotheses.entries()) {
    if (hypothesis.status !== "accepted") continue;
    const set = workspace.routeProposalSets.find(
      (candidate) => candidate.ref === hypothesis.originatingRouteSetRef,
    );
    const route = set?.routes.find(
      (candidate) => candidate.ref === hypothesis.originatingRouteRef,
    );
    if (
      !set || !route || set.status !== "resolved" ||
      set.selectedRouteRef !== route.ref || route.status !== "selected" ||
      hypothesis.claim !== route.premise ||
      JSON.stringify(hypothesis.sourceQuotes) !== JSON.stringify(route.sourceQuotes)
    ) {
      context.addIssue({
        code: "custom",
        path: ["hypotheses", hypothesisIndex],
        message: "An accepted hypothesis must agree with its selected originating route and set.",
      });
    }
  }
});
export type Workspace = z.infer<typeof workspaceSchema>;

export function createEmptyWorkspace(
  id = "00000000-0000-4000-8000-000000000001",
): Workspace {
  return workspaceSchema.parse({
    id,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    contractVersion: CONTRACT_VERSION,
    stateVersion: 0,
    phase: "EXPLORING",
    participant: {
      displayName: "",
      focusQuestion: "",
      costCaps: { hoursPerWeek: 0, money: 0, currency: "XXX" },
    },
    reflections: [],
    routeProposalSets: [],
    hypotheses: [],
    experiments: [],
    evidence: [],
    revisions: [],
    planItems: [],
    outbox: [],
    teachings: [],
    operations: [],
  });
}

export function publicReceipt(record: OperationRecord): OperationReceipt {
  return operationReceiptSchema.parse({
    operationId: record.operationId,
    operationRef: record.operationRef,
    actor: record.actor,
    command: record.command,
    effect: record.effect,
    beforeVersion: record.beforeVersion,
    afterVersion: record.afterVersion,
    changedRefs: record.changedRefs,
    at: record.at,
    compensatesOperationRef: record.compensatesOperationRef,
  });
}
