import { z } from "zod";
import type { ToolResult } from "./results";
import { availableActionSchema, phaseSchema, reflectionSchema } from "./workspace";

export const READ_ENTITY_LIMIT = 20;
export const READ_CHANGE_LIMIT = 20;
export const ORIENTATION_MAX_SERIALIZED_CHARS = 6_000;
export const ORIENTATION_ESTIMATED_TOKEN_BUDGET = 3_000;

const cursorSchema = z.string().min(1).max(200);

export const readWorkspaceInputSchema = z.union([
  z.strictObject({
    view: z.literal("orientation").optional(),
    sinceCursor: cursorSchema.optional(),
  }),
  z.strictObject({
    view: z.literal("working_set"),
    sinceCursor: cursorSchema.optional(),
  }),
  z.strictObject({
    view: z.literal("entities"),
    refs: z.array(z.string().min(1).max(128)).min(1).max(READ_ENTITY_LIMIT),
  }),
]);
export type ReadWorkspaceInput = z.infer<typeof readWorkspaceInputSchema>;

export const workspaceIdentitySchema = z.strictObject({
  workspaceRef: z.string().uuid(),
  schemaVersion: z.number().int().positive(),
  contractVersion: z.string().min(1).max(32),
  stateVersion: z.number().int().nonnegative(),
  phase: phaseSchema,
});
export type WorkspaceIdentity = z.infer<typeof workspaceIdentitySchema>;

export const changeSummarySchema = z.strictObject({
  operationRef: z.string().min(1).max(128),
  command: z.string().min(1).max(64),
  effect: z.enum(["APPLIED", "PROPOSED", "AWAITING_HUMAN", "COMPENSATED"]),
  afterVersion: z.number().int().nonnegative(),
  changedRefs: z.array(z.string().min(1).max(128)).max(READ_ENTITY_LIMIT),
  changedRefsTruncated: z.boolean(),
  at: z.string().datetime({ offset: true }),
});
export type ChangeSummary = z.infer<typeof changeSummarySchema>;

const changesSchema = z.strictObject({
  sinceCursor: cursorSchema.nullable(),
  items: z.array(changeSummarySchema).max(READ_CHANGE_LIMIT),
  truncated: z.boolean(),
});

const emptyProjectionCollectionSchema = z.array(z.never()).length(0);

export const orientationProjectionSchema = z.strictObject({
  view: z.literal("orientation"),
  identity: workspaceIdentitySchema,
  focus: z.strictObject({
    question: z.string().max(500).nullable(),
    costCaps: z.strictObject({
      hoursPerWeek: z.number().nonnegative(),
      money: z.number().nonnegative(),
      currency: z.string().length(3),
    }),
  }),
  active: z.strictObject({ hypothesis: z.null(), experiment: z.null() }),
  nextHumanDecision: z.strictObject({
    kind: z.enum(["ADD_REFLECTION", "REVIEW_PROPOSED_REFLECTION"]),
    targetRefs: z.array(z.string().min(1).max(128)).max(READ_ENTITY_LIMIT),
    guidance: z.string().min(1).max(240),
  }),
  constraints: z.array(z.string().min(1).max(240)).max(READ_ENTITY_LIMIT),
  teachings: emptyProjectionCollectionSchema,
  pendingHumanInteractions: z.strictObject({
    items: z
      .array(
        z.strictObject({
          ref: z.string().min(1).max(128),
          kind: z.literal("CONFIRM_REFLECTION"),
          excerpt: z.string().min(1).max(160),
        }),
      )
      .max(READ_ENTITY_LIMIT),
    total: z.number().int().nonnegative(),
    truncated: z.boolean(),
  }),
  conflicts: emptyProjectionCollectionSchema,
  changes: changesSchema,
  cursor: cursorSchema,
  availableActions: z.array(availableActionSchema).max(READ_ENTITY_LIMIT),
  proof: z.strictObject({
    level: z.enum(["NONE", "PROPOSED", "PARTICIPANT_CONFIRMED"]),
    confirmedReflectionCount: z.number().int().nonnegative(),
    proposedReflectionCount: z.number().int().nonnegative(),
  }),
  guidance: z.string().min(1).max(240),
});
export type OrientationProjection = z.infer<typeof orientationProjectionSchema>;

export const workingSetProjectionSchema = z.strictObject({
  view: z.literal("working_set"),
  identity: workspaceIdentitySchema,
  reflections: z.array(reflectionSchema).max(READ_ENTITY_LIMIT),
  truncated: z.boolean(),
  changes: changesSchema,
  cursor: cursorSchema,
  availableActions: z.array(availableActionSchema).max(READ_ENTITY_LIMIT),
  guidance: z.string().min(1).max(240),
});
export type WorkingSetProjection = z.infer<typeof workingSetProjectionSchema>;

export const entitiesProjectionSchema = z.strictObject({
  view: z.literal("entities"),
  identity: workspaceIdentitySchema,
  entities: z.array(reflectionSchema).max(READ_ENTITY_LIMIT),
  missingRefs: z.array(z.string().min(1).max(128)).max(READ_ENTITY_LIMIT),
  availableActions: z.array(availableActionSchema).max(READ_ENTITY_LIMIT),
  guidance: z.string().min(1).max(240),
});
export type EntitiesProjection = z.infer<typeof entitiesProjectionSchema>;

export const readWorkspaceProjectionSchema = z.union([
  orientationProjectionSchema,
  workingSetProjectionSchema,
  entitiesProjectionSchema,
]);
export type ReadWorkspaceProjection = z.infer<typeof readWorkspaceProjectionSchema>;

export type ReadWorkspaceResult = ToolResult<ReadWorkspaceProjection>;
