import { z } from "zod";
import {
  costCapsSchema,
  quoteSourceSchema,
  routeKindSchema,
  routeTestSchema,
} from "./workspace";

const refSchema = z.string().trim().min(1).max(128);
const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const writeControlSchema = z.strictObject({
  operationId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
});

export const saveReflectionInputSchema = writeControlSchema.extend({
  text: z.string().trim().min(1).max(2_000),
  answersFollowUpRef: refSchema.optional(),
});
export type SaveReflectionInput = z.infer<typeof saveReflectionInputSchema>;

export const saveReflectionCommandSchema = z.strictObject({
  name: z.literal("save_reflection"),
  input: saveReflectionInputSchema,
});
export type SaveReflectionCommand = z.infer<typeof saveReflectionCommandSchema>;

export const setLimitsInputSchema = writeControlSchema.extend({
  costCaps: costCapsSchema.extend({
    hoursPerWeek: z.number().positive().max(168),
    money: z.number().nonnegative().max(1_000_000),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
  focusQuestion: z.string().trim().max(500).optional(),
});
export type SetLimitsInput = z.infer<typeof setLimitsInputSchema>;

export const setLimitsCommandSchema = z.strictObject({
  name: z.literal("set_limits"),
  input: setLimitsInputSchema,
});
export type SetLimitsCommand = z.infer<typeof setLimitsCommandSchema>;

export const routeProposalInputSchema = z.strictObject({
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
});
export type RouteProposalInput = z.infer<typeof routeProposalInputSchema>;

/**
 * When a proposal supersedes a set that is still proposed, every route the participant kept must
 * be carried over unchanged. Only routes the participant set aside may be replaced.
 */
export const carriedRouteInputSchema = z.strictObject({
  carryRouteRef: refSchema,
});
export type CarriedRouteInput = z.infer<typeof carriedRouteInputSchema>;

export const routeSlotInputSchema = z.union([routeProposalInputSchema, carriedRouteInputSchema]);
export type RouteSlotInput = z.infer<typeof routeSlotInputSchema>;

const proposeRoutesInputSchema = writeControlSchema.extend({
  outcome: z.literal("routes"),
  routes: z.tuple([routeSlotInputSchema, routeSlotInputSchema, routeSlotInputSchema]),
  supersedesRouteSetRef: refSchema.optional(),
});

const insufficientSignalInputSchema = writeControlSchema.extend({
  outcome: z.literal("insufficient_signal"),
  followUpQuestion: boundedText(300),
  reasonRefs: z.array(refSchema).min(1).max(5),
});

export const proposeRouteSetInputSchema = z.discriminatedUnion("outcome", [
  proposeRoutesInputSchema,
  insufficientSignalInputSchema,
]);
export type ProposeRouteSetInput = z.infer<typeof proposeRouteSetInputSchema>;

export const proposeRouteSetCommandSchema = z.strictObject({
  name: z.literal("propose_route_set"),
  input: proposeRouteSetInputSchema,
});
export type ProposeRouteSetCommand = z.infer<typeof proposeRouteSetCommandSchema>;

export const routeEditSchema = z.strictObject({
  routeRef: refSchema,
  title: boundedText(120).optional(),
  premise: boundedText(600).optional(),
  sourceQuotes: z.array(quoteSourceSchema).min(1).max(5).optional(),
  constraint: boundedText(300).optional(),
  learningQuestion: boundedText(300).optional(),
  test: routeTestSchema.optional(),
  strengthensWhen: boundedText(300).optional(),
  weakensWhen: boundedText(300).optional(),
}).superRefine((edit, context) => {
  if (Object.keys(edit).every((key) => key === "routeRef")) {
    context.addIssue({ code: "custom", message: "An edit must change at least one route field." });
  }
});
export type RouteEdit = z.infer<typeof routeEditSchema>;

export const reviseRouteSetInputSchema = writeControlSchema.extend({
  routeSetRef: refSchema,
  edits: z.array(routeEditSchema).max(3).optional(),
  rejectRouteRefs: z.array(refSchema).max(3).optional(),
}).superRefine((input, context) => {
  if ((input.edits?.length ?? 0) === 0 && (input.rejectRouteRefs?.length ?? 0) === 0) {
    context.addIssue({ code: "custom", message: "At least one edit or rejection is required." });
  }
});
export type ReviseRouteSetInput = z.infer<typeof reviseRouteSetInputSchema>;

export const reviseRouteSetCommandSchema = z.strictObject({
  name: z.literal("revise_route_set"),
  input: reviseRouteSetInputSchema,
});
export type ReviseRouteSetCommand = z.infer<typeof reviseRouteSetCommandSchema>;

export const chooseRouteInputSchema = writeControlSchema.extend({
  routeSetRef: refSchema,
  routeRef: refSchema,
  finalEdit: routeEditSchema.optional(),
  influenceFlags: z.array(z.enum(["peer", "trend", "parent", "prestige", "fear"])).max(5).optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type ChooseRouteInput = z.infer<typeof chooseRouteInputSchema>;

export const chooseRouteCommandSchema = z.strictObject({
  name: z.literal("choose_route"),
  input: chooseRouteInputSchema,
});
export type ChooseRouteCommand = z.infer<typeof chooseRouteCommandSchema>;

export const compensateRouteSetInputSchema = writeControlSchema.extend({
  routeSetRef: refSchema,
});
export type CompensateRouteSetInput = z.infer<typeof compensateRouteSetInputSchema>;

export const compensateRouteSetCommandSchema = z.strictObject({
  name: z.literal("compensate_route_set"),
  input: compensateRouteSetInputSchema,
});
export type CompensateRouteSetCommand = z.infer<typeof compensateRouteSetCommandSchema>;

export const skipFollowUpInputSchema = writeControlSchema.extend({
  followUpRef: refSchema,
});
export type SkipFollowUpInput = z.infer<typeof skipFollowUpInputSchema>;

export const skipFollowUpCommandSchema = z.strictObject({
  name: z.literal("skip_follow_up"),
  input: skipFollowUpInputSchema,
});
export type SkipFollowUpCommand = z.infer<typeof skipFollowUpCommandSchema>;

export const reopenExploringInputSchema = writeControlSchema.extend({
  hypothesisRef: refSchema,
});
export type ReopenExploringInput = z.infer<typeof reopenExploringInputSchema>;

export const reopenExploringCommandSchema = z.strictObject({
  name: z.literal("reopen_exploring"),
  input: reopenExploringInputSchema,
});
export type ReopenExploringCommand = z.infer<typeof reopenExploringCommandSchema>;

export const commandSchema = z.discriminatedUnion("name", [
  saveReflectionCommandSchema,
  setLimitsCommandSchema,
  proposeRouteSetCommandSchema,
  reviseRouteSetCommandSchema,
  chooseRouteCommandSchema,
  compensateRouteSetCommandSchema,
  skipFollowUpCommandSchema,
  reopenExploringCommandSchema,
]);
export type Command = z.infer<typeof commandSchema>;
export type CommandName = Command["name"];

export const PARTICIPANT_ONLY_COMMANDS: readonly CommandName[] = [
  "set_limits",
  "revise_route_set",
  "choose_route",
  "compensate_route_set",
  "skip_follow_up",
  "reopen_exploring",
];

export function commandRequestIdentity(
  command: Command,
  actor: "participant" | "agent",
  proposalSource?: "participant" | "chatgpt_webmcp" | "embedded_inference",
): string {
  const intent = Object.fromEntries(
    Object.entries(command.input).filter(([key]) => key !== "operationId" && key !== "expectedVersion"),
  );
  return JSON.stringify({
    name: command.name,
    actor,
    ...(command.name === "propose_route_set" ? { proposalSource } : {}),
    input: intent,
  });
}

export function reflectionRequestIdentity(
  command: SaveReflectionCommand,
  actor: "participant" | "agent",
): string {
  return commandRequestIdentity(command, actor);
}
