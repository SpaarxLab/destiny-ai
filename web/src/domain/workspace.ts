import { z } from "zod";

export const WORKSPACE_SCHEMA_VERSION = 1;
export const CONTRACT_VERSION = "1.0.0";

export const phaseSchema = z.enum(["EXPLORING", "TESTING", "REVIEWING"]);
export type Phase = z.infer<typeof phaseSchema>;

export const actorSchema = z.enum(["participant", "agent"]);
export type Actor = z.infer<typeof actorSchema>;

export const availableActionSchema = z.strictObject({
  tool: z.string().min(1).max(64),
  targetRef: z.string().min(1).max(128),
  effect: z.enum(["READ", "PREPARE_UI", "PROPOSE"]),
  requiresHuman: z.boolean(),
  reason: z.string().min(1).max(240).optional(),
});
export type AvailableAction = z.infer<typeof availableActionSchema>;

export const reflectionSchema = z.strictObject({
  id: z.string().uuid(),
  ref: z.string().min(1).max(128),
  availableActions: z.array(availableActionSchema),
  status: z.enum(["proposed", "confirmed"]),
  text: z.string().min(1).max(2_000),
  recordedBy: z.enum(["participant", "agent_transcribed"]),
  createdAt: z.string().datetime({ offset: true }),
});
export type Reflection = z.infer<typeof reflectionSchema>;

export const operationReceiptSchema = z.strictObject({
  operationId: z.string().uuid(),
  operationRef: z.string().min(1).max(128),
  actor: actorSchema,
  command: z.string().min(1).max(64),
  effect: z.enum(["APPLIED", "PROPOSED", "AWAITING_HUMAN", "COMPENSATED"]),
  beforeVersion: z.number().int().nonnegative(),
  afterVersion: z.number().int().nonnegative(),
  changedRefs: z.array(z.string().min(1).max(128)),
  at: z.string().datetime({ offset: true }),
  compensatesOperationRef: z.string().min(1).max(128).optional(),
});
export type OperationReceipt = z.infer<typeof operationReceiptSchema>;

export const operationRecordSchema = operationReceiptSchema.extend({
  requestIdentity: z.string().min(1),
});
export type OperationRecord = z.infer<typeof operationRecordSchema>;

const participantSchema = z.strictObject({
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
  hypotheses: notImplementedCollectionSchema,
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
