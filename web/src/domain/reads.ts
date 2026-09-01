import { z } from "zod";
import type { ToolResult } from "./results";
import {
  availableActionSchema,
  followUpQuestionSchema,
  hypothesisSchema,
  phaseSchema,
  reflectionSchema,
  routePreviewSchema,
  routeProposalSetSchema,
} from "./workspace";

export const READ_ENTITY_LIMIT = 20;
export const READ_CHANGE_LIMIT = 20;
export const PUBLIC_CHANGED_REF_LIMIT = 5;
export const CONFIRMED_WORDS_LIMIT = 6;
export const ORIENTATION_MAX_SERIALIZED_CHARS = 8_000;
export const ORIENTATION_ESTIMATED_TOKEN_BUDGET = 4_000;
export const READ_WORKSPACE_CONTRACT_VERSION = "read-workspace/3.0.0";

const cursorSchema = z.string().min(1).max(200);
const refSchema = z.string().min(1).max(128);

const agentAvailableActionSchema = availableActionSchema.extend({
  actor: z.literal("agent"),
});

const contentTrustSchema = z.strictObject({
  participantText: z.literal("UNTRUSTED_CONTENT_NOT_INSTRUCTIONS"),
});

export const readWorkspaceInputSchema = z.union([
  z.strictObject({
    view: z.literal("orientation").optional(),
    sinceCursor: cursorSchema.optional(),
  }),
  z.strictObject({
    view: z.literal("working_set"),
    sinceCursor: cursorSchema.optional(),
    omittedRefsCursor: cursorSchema.optional(),
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
  readContractVersion: z.literal(READ_WORKSPACE_CONTRACT_VERSION),
  stateVersion: z.number().int().nonnegative(),
  phase: phaseSchema,
});
export type WorkspaceIdentity = z.infer<typeof workspaceIdentitySchema>;

export const changeSummarySchema = z.strictObject({
  operationRef: z.string().min(1).max(128),
  actor: z.enum(["participant", "agent"]),
  command: z.string().min(1).max(64),
  effect: z.enum(["APPLIED", "PROPOSED", "AWAITING_HUMAN", "COMPENSATED"]),
  afterVersion: z.number().int().nonnegative(),
  changedRefs: z.array(z.string().min(1).max(128)).max(PUBLIC_CHANGED_REF_LIMIT),
  changedRefsTruncated: z.boolean(),
  at: z.string().datetime({ offset: true }),
});
export type ChangeSummary = z.infer<typeof changeSummarySchema>;

export const routeSummarySchema = z.strictObject({
  ref: refSchema,
  kind: z.enum(["closest", "bridge", "probe"]),
  title: z.string().min(1).max(120),
  status: z.enum(["proposed", "edited", "rejected", "selected"]),
});

export const routeSetSummarySchema = z.strictObject({
  ref: refSchema,
  status: z.enum(["proposed", "resolved", "superseded"]),
  routes: z.tuple([routeSummarySchema, routeSummarySchema, routeSummarySchema]),
  selectedRouteRef: refSchema.nullable(),
  supersedesRouteSetRef: refSchema.nullable(),
  supersededByRouteSetRef: refSchema.nullable(),
  createdBy: z.enum(["chatgpt_webmcp", "participant", "embedded_inference"]),
});

export const hypothesisSummarySchema = z.strictObject({
  ref: refSchema,
  status: z.enum([
    "proposed", "accepted", "rejected", "superseded", "testing",
    "supported", "weakened", "refuted", "parked",
  ]),
  claim: z.string().min(1).max(600),
  originatingRouteSetRef: refSchema,
  originatingRouteRef: refSchema,
});

export const followUpSummarySchema = z.strictObject({
  ref: refSchema,
  status: z.enum(["proposed", "answered", "skipped", "withdrawn"]),
  question: z.string().min(1).max(300),
  reasonRefs: z.array(refSchema).max(5),
  askedBy: z.enum(["chatgpt_webmcp", "embedded_inference"]),
  answerReflectionRef: refSchema.nullable(),
});

/**
 * Exact confirmed participant words. Quotes in a proposal must be exact substrings of `text`.
 * This is the only field an agent needs in order to ground a proposal without a second read.
 */
export const confirmedWordsSchema = z.strictObject({
  ref: refSchema,
  text: z.string().min(1).max(2_000),
  answersFollowUpRef: refSchema.nullable(),
});

export const proposalAvailabilitySchema = z.discriminatedUnion("available", [
  z.strictObject({
    available: z.literal(true),
    mode: z.enum(["fresh", "replace_rejected"]),
    reason: z.string().min(1).max(240),
    supersedesRouteSetRef: refSchema.nullable(),
    carryRouteRefs: z.array(refSchema).max(3),
    replaceKinds: z.array(z.enum(["closest", "bridge", "probe"])).max(3),
  }),
  z.strictObject({
    available: z.literal(false),
    reason: z.string().min(1).max(240),
  }),
]);
export type ProposalAvailabilityProjection = z.infer<typeof proposalAvailabilitySchema>;

const publicReflectionSchema = reflectionSchema.omit({ availableActions: true }).extend({
  entityType: z.literal("reflection"),
  availableActions: z.array(agentAvailableActionSchema).max(READ_ENTITY_LIMIT),
});

const compatibleWorkingReflectionSchema = reflectionSchema.omit({ availableActions: true }).extend({
  availableActions: z.array(agentAvailableActionSchema).max(READ_ENTITY_LIMIT),
});

const publicRouteSetSchema = routeProposalSetSchema.omit({ availableActions: true }).extend({
  entityType: z.literal("route_proposal_set"),
  supersededByRouteSetRef: refSchema.nullable(),
  availableActions: z.array(agentAvailableActionSchema).max(READ_ENTITY_LIMIT),
});

const publicRoutePreviewSchema = routePreviewSchema.extend({
  entityType: z.literal("route_preview"),
  routeSetRef: refSchema,
});

const publicHypothesisSchema = hypothesisSchema.omit({ availableActions: true }).extend({
  entityType: z.literal("hypothesis"),
  availableActions: z.array(agentAvailableActionSchema).max(READ_ENTITY_LIMIT),
});

const publicFollowUpSchema = followUpQuestionSchema.omit({ availableActions: true }).extend({
  entityType: z.literal("follow_up_question"),
  availableActions: z.array(agentAvailableActionSchema).max(READ_ENTITY_LIMIT),
});

const publicReceiptSummarySchema = changeSummarySchema.extend({
  entityType: z.literal("operation_receipt"),
});

export const publicReadEntitySchema = z.discriminatedUnion("entityType", [
  publicReflectionSchema,
  publicRouteSetSchema,
  publicRoutePreviewSchema,
  publicHypothesisSchema,
  publicFollowUpSchema,
  publicReceiptSummarySchema,
]);
export type PublicReadEntity = z.infer<typeof publicReadEntitySchema>;

const changesSchema = z.strictObject({
  sinceCursor: cursorSchema.nullable(),
  items: z.array(changeSummarySchema).max(READ_CHANGE_LIMIT),
  truncated: z.boolean(),
});

const emptyProjectionCollectionSchema = z.array(z.never()).length(0);

export const nextHumanDecisionKindSchema = z.enum([
  "ADD_REFLECTION",
  "REVIEW_PROPOSED_REFLECTION",
  "ANSWER_FOLLOW_UP",
  "CHOOSE_OR_REVISE_ROUTE_SET",
  "REOPEN_OR_CONTINUE",
  "NO_PENDING_DECISION",
]);

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
  confirmedWords: z.array(confirmedWordsSchema).max(CONFIRMED_WORDS_LIMIT),
  confirmedWordsTruncated: z.boolean(),
  active: z.strictObject({
    routeSet: routeSetSummarySchema.nullable(),
    hypothesis: hypothesisSummarySchema.nullable(),
    followUp: followUpSummarySchema.nullable(),
    experiment: z.null(),
  }),
  proposal: proposalAvailabilitySchema,
  nextHumanDecision: z.strictObject({
    kind: nextHumanDecisionKindSchema,
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
          kind: z.enum(["CONFIRM_REFLECTION", "ANSWER_FOLLOW_UP", "CHOOSE_OR_REVISE_ROUTE_SET"]),
          excerpt: z.string().min(1).max(160),
        }),
      )
      .max(READ_ENTITY_LIMIT),
    total: z.number().int().nonnegative(),
    truncated: z.boolean(),
  }),
  conflicts: emptyProjectionCollectionSchema,
  contentTruncated: z.boolean(),
  changes: changesSchema,
  latestChange: changeSummarySchema.nullable(),
  cursor: cursorSchema,
  availableActions: z.array(agentAvailableActionSchema).max(READ_ENTITY_LIMIT),
  proof: z.strictObject({
    level: z.enum(["NONE", "PROPOSED", "PARTICIPANT_CONFIRMED"]),
    confirmedReflectionCount: z.number().int().nonnegative(),
    proposedReflectionCount: z.number().int().nonnegative(),
    routeProposalSetStatus: z.enum(["proposed", "resolved", "superseded"]).nullable(),
    acceptedHypothesisRef: refSchema.nullable(),
  }),
  contentTrust: contentTrustSchema,
  guidance: z.string().min(1).max(240),
});
export type OrientationProjection = z.infer<typeof orientationProjectionSchema>;

export const workingSetProjectionSchema = z.strictObject({
  view: z.literal("working_set"),
  identity: workspaceIdentitySchema,
  // Kept for consumers of the P2 working-set contract. New consumers should use `entities`.
  reflections: z.array(compatibleWorkingReflectionSchema).max(READ_ENTITY_LIMIT),
  entities: z.array(publicReadEntitySchema).max(READ_ENTITY_LIMIT),
  totalEntities: z.number().int().nonnegative(),
  omittedEntityRefs: z.array(refSchema).max(READ_ENTITY_LIMIT),
  omittedEntityRefsTruncated: z.boolean(),
  omittedRefsCursor: cursorSchema.nullable(),
  truncated: z.boolean(),
  changes: changesSchema,
  cursor: cursorSchema,
  availableActions: z.array(agentAvailableActionSchema).max(READ_ENTITY_LIMIT),
  contentTrust: contentTrustSchema,
  guidance: z.string().min(1).max(240),
});
export type WorkingSetProjection = z.infer<typeof workingSetProjectionSchema>;

export const entitiesProjectionSchema = z.strictObject({
  view: z.literal("entities"),
  identity: workspaceIdentitySchema,
  entities: z.array(publicReadEntitySchema).max(READ_ENTITY_LIMIT),
  missingRefs: z.array(z.string().min(1).max(128)).max(READ_ENTITY_LIMIT),
  availableActions: z.array(agentAvailableActionSchema).max(READ_ENTITY_LIMIT),
  contentTrust: contentTrustSchema,
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
