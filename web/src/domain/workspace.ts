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

export const workspaceSchema = z.strictObject({
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
