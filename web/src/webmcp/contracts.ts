import { z } from "zod";
import {
  READ_ENTITY_LIMIT,
  readWorkspaceProjectionSchema,
} from "../domain/reads";
import {
  availableActionSchema,
  CONTRACT_VERSION,
  operationReceiptSchema,
  routeProposalSetSchema,
  type AvailableAction,
} from "../domain/workspace";

export const METHOD_VERSION = "destiny-method/1.0.0";

const toolErrorSchema = z.strictObject({
  code: z.string().min(1).max(64),
  what: z.string().min(1).max(500),
  retry: z.enum(["NEVER", "SAME_OPERATION_ID", "REREAD_THEN_NEW_OPERATION"]),
  insteadDo: z.string().min(1).max(500).optional(),
  example: z.unknown().optional(),
  changedRefs: z.array(z.string().min(1).max(128)).max(READ_ENTITY_LIMIT).optional(),
});

const agentAvailableActionSchema = availableActionSchema.extend({
  actor: z.literal("agent"),
});

const publicCommandErrorSchema = z.strictObject({
  code: z.enum([
    "MALFORMED_INPUT",
    "WRONG_ACTOR",
    "WRONG_PHASE",
    "WRONG_LIFECYCLE",
    "UNKNOWN_REF",
    "POLICY_DENIED",
    "STALE_STATE",
    "OPERATION_CONFLICT",
    "INVALID_CURSOR",
    "STORAGE_FAILURE",
    "STALE_REGISTRATION",
  ]),
  what: z.string().min(1).max(500),
  retry: z.enum(["NEVER", "SAME_OPERATION_ID", "REREAD_THEN_NEW_OPERATION"]),
  insteadDo: z.string().min(1).max(500).optional(),
  example: z.unknown().optional(),
  changedRefs: z.array(z.string().min(1).max(128)).max(READ_ENTITY_LIMIT).optional(),
  changedRefsTruncated: z.boolean().optional(),
});

const pendingRouteInteractionSchema = z.strictObject({
  kind: z.enum([
    "REVISE_OR_REJECT_ROUTE_SET",
    "CHOOSE_ROUTE",
    "RESOLVE_ROUTE_SET",
  ]),
  targetRef: z.string().min(1).max(128),
  guidance: z.string().min(1).max(240),
});

export const publicProposedRouteSetSchema = routeProposalSetSchema
  .omit({ availableActions: true })
  .extend({
    createdBy: z.literal("chatgpt_webmcp"),
    pendingHumanInteractions: z.strictObject({
      items: z.array(pendingRouteInteractionSchema).max(3),
      total: z.number().int().nonnegative().max(3),
    }),
  });

const webMcpProposalReceiptSchema = operationReceiptSchema.omit({
  actor: true,
  command: true,
  effect: true,
  changedRefs: true,
  compensatesOperationRef: true,
}).extend({
  actor: z.literal("agent"),
  command: z.literal("propose_route_set"),
  effect: z.literal("PROPOSED"),
  changedRefs: z.array(z.string().min(1).max(128)).min(1).max(2),
}).superRefine((receipt, context) => {
  if (receipt.afterVersion !== receipt.beforeVersion + 1) {
    context.addIssue({
      code: "custom",
      path: ["afterVersion"],
      message: "A proposal receipt must advance exactly one workspace version.",
    });
  }
});

const publicResultFields = {
  nextActions: z.array(agentAvailableActionSchema).max(READ_ENTITY_LIMIT),
  stateVersion: z.number().int().nonnegative(),
  guidance: z.string().min(1).max(500),
};

export const webMcpProposeRouteSetResultSchema = z.union([
  z.strictObject({
    ok: z.literal(true),
    data: z.strictObject({
      outcome: z.literal("routes"),
      routeSet: publicProposedRouteSetSchema,
    }),
    receipt: webMcpProposalReceiptSchema,
    ...publicResultFields,
  }),
  z.strictObject({
    ok: z.literal(true),
    data: z.strictObject({
      outcome: z.literal("insufficient_signal"),
      followUpQuestion: z.string().trim().min(1).max(300),
      reasonRefs: z.array(z.string().trim().min(1).max(128)).min(1).max(5),
    }),
    ...publicResultFields,
  }),
  z.strictObject({
    ok: z.literal(false),
    error: publicCommandErrorSchema,
    ...publicResultFields,
  }),
]);
export type WebMcpProposeRouteSetResult = z.infer<
  typeof webMcpProposeRouteSetResultSchema
>;

export const webMcpReadWorkspaceResultSchema = z.strictObject({
  ok: z.boolean(),
  data: readWorkspaceProjectionSchema.optional(),
  error: toolErrorSchema.optional(),
  nextActions: z.array(availableActionSchema).max(READ_ENTITY_LIMIT),
  stateVersion: z.number().int().nonnegative(),
  guidance: z.string().min(1).max(500),
}).superRefine((result, context) => {
  if (result.ok === (result.data === undefined)) {
    context.addIssue({
      code: "custom",
      message: result.ok ? "Successful reads require data." : "Failed reads cannot include data.",
    });
  }
  if (result.ok === (result.error !== undefined)) {
    context.addIssue({
      code: "custom",
      message: result.ok ? "Successful reads cannot include an error." : "Failed reads require an error.",
    });
  }
});

export type MethodGuideResult = z.infer<typeof methodGuideResultSchema>;

export const methodGuideResultSchema = z.strictObject({
  ok: z.literal(true),
  data: z.strictObject({
    methodVersion: z.literal(METHOD_VERSION),
    contractVersion: z.literal(CONTRACT_VERSION),
    promise: z.string().min(1).max(240),
    principles: z.array(z.string().min(1).max(240)).min(1).max(10),
    boundaries: z.array(z.string().min(1).max(240)).min(1).max(10),
  }),
  nextActions: z.array(availableActionSchema).max(READ_ENTITY_LIMIT),
  stateVersion: z.number().int().nonnegative(),
  guidance: z.string().min(1).max(500),
});

export function staleRegistrationResult() {
  return webMcpReadWorkspaceResultSchema.parse({
    ok: false,
    error: {
      code: "STALE_REGISTRATION",
      what: "This tool registration is no longer active for the current page lifecycle.",
      retry: "NEVER",
      insteadDo: "Discard the cached tool and rediscover the current page catalogue.",
    },
    nextActions: [],
    stateVersion: 0,
    guidance: "No state was read or changed because the cached registration was stale.",
  });
}

export function getMethodGuide(
  stateVersion: number,
  nextActions: readonly AvailableAction[],
): MethodGuideResult {
  return methodGuideResultSchema.parse({
    ok: true,
    data: {
      methodVersion: METHOD_VERSION,
      contractVersion: CONTRACT_VERSION,
      promise: "Find one direction worth testing next; do not predict a whole career.",
      principles: [
        "Ground proposals in the participant's confirmed words and recorded constraints.",
        "Prefer small, reversible experiments that can produce real evidence.",
        "Treat proposals as inspectable ghosts until the participant accepts, edits, or rejects them.",
      ],
      boundaries: [
        "The participant owns every durable decision and every real-world send.",
        "Proposed or unconfirmed content is not evidence.",
        "This product is structured career-direction practice, not therapy or career prediction.",
      ],
    },
    nextActions,
    stateVersion,
    guidance: "Use this versioned guide to interpret workspace state without inventing authority.",
  });
}
