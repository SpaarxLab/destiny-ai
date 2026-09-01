import { z } from "zod";
import {
  READ_ENTITY_LIMIT,
  readWorkspaceProjectionSchema,
} from "../domain/reads";
import {
  availableActionSchema,
  CONTRACT_VERSION,
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
