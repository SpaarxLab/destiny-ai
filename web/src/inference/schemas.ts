import { z } from "zod";
import { routeSlotInputSchema } from "../domain/commands";
import { routeKindSchema } from "../domain/workspace";

/**
 * Lab assistant contract (D-014). The embedded proposal source receives a bounded projection of
 * the orientation view and returns a typed proposal. It owns no persistence, policy, permission,
 * or memory: the browser-side command kernel remains the only authority for what is accepted.
 */

const refSchema = z.string().trim().min(1).max(128);
const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const ROUTE_KINDS = ["closest", "bridge", "probe"] as const;

export const labAssistantConfirmedWordsSchema = z.strictObject({
  ref: refSchema,
  text: z.string().min(1).max(2_000),
});
export type LabAssistantConfirmedWords = z.infer<typeof labAssistantConfirmedWordsSchema>;

export const labAssistantCostCapsSchema = z.strictObject({
  hoursPerWeek: z.number().nonnegative().max(168),
  money: z.number().nonnegative().max(1_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export const labAssistantKeptRouteSchema = z.strictObject({
  ref: refSchema,
  kind: routeKindSchema,
  title: boundedText(120),
});

export const labAssistantInputSchema = z
  .strictObject({
    confirmedWords: z.array(labAssistantConfirmedWordsSchema).min(1).max(6),
    costCaps: labAssistantCostCapsSchema,
    supersedesRouteSetRef: refSchema.nullable(),
    carryRouteRefs: z.array(refSchema).max(3),
    replaceKinds: z.array(routeKindSchema).min(1).max(3),
    keptRoutes: z.array(labAssistantKeptRouteSchema).max(3).optional(),
  })
  .superRefine((input, context) => {
    if (new Set(input.replaceKinds).size !== input.replaceKinds.length) {
      context.addIssue({ code: "custom", path: ["replaceKinds"], message: "replaceKinds must be distinct." });
    }
    if (new Set(input.carryRouteRefs).size !== input.carryRouteRefs.length) {
      context.addIssue({ code: "custom", path: ["carryRouteRefs"], message: "carryRouteRefs must be distinct." });
    }
    if (input.carryRouteRefs.length + input.replaceKinds.length !== 3) {
      context.addIssue({
        code: "custom",
        path: ["replaceKinds"],
        message: "carryRouteRefs plus replaceKinds must describe exactly three route slots.",
      });
    }
    if (new Set(input.confirmedWords.map((words) => words.ref)).size !== input.confirmedWords.length) {
      context.addIssue({ code: "custom", path: ["confirmedWords"], message: "confirmedWords refs must be distinct." });
    }
    if (input.keptRoutes) {
      const keptRefs = input.keptRoutes.map((route) => route.ref).sort();
      const carried = [...input.carryRouteRefs].sort();
      if (JSON.stringify(keptRefs) !== JSON.stringify(carried)) {
        context.addIssue({
          code: "custom",
          path: ["keptRoutes"],
          message: "keptRoutes must list exactly the carryRouteRefs.",
        });
      }
      const keptKinds = input.keptRoutes.map((route) => route.kind);
      if (keptKinds.some((kind) => input.replaceKinds.includes(kind))) {
        context.addIssue({
          code: "custom",
          path: ["keptRoutes"],
          message: "A kept route kind cannot also be a replaced kind.",
        });
      }
    }
  });
export type LabAssistantInput = z.infer<typeof labAssistantInputSchema>;

/**
 * What the model is asked to produce. Refs are deliberately absent: the server generates fresh
 * refs after grounding so a model can never collide with or impersonate existing workspace refs.
 * The shape is flat (no root-level union) because OpenAI-compatible structured-output endpoints
 * reject or mangle `anyOf` at the schema root far more often than a flat object.
 */
export const draftRouteSchema = z.object({
  kind: routeKindSchema.describe("closest = nearest to the confirmed words; bridge = combines two confirmed threads; probe = a reversible test of something less familiar."),
  title: boundedText(120),
  premise: boundedText(600).describe("Why this direction follows from the quoted words."),
  sourceQuotes: z
    .array(
      z.object({
        reflectionRef: refSchema.describe("The ref of the confirmed words the quote is copied from."),
        quote: boundedText(500).describe("An exact, character-for-character substring of that confirmed text."),
      }),
    )
    .min(1)
    .max(5),
  constraint: boundedText(300).describe("The limit this route respects, in the participant's terms."),
  learningQuestion: boundedText(300).describe("The one question the test answers. Must differ across routes."),
  test: z.object({
    action: boundedText(500).describe("A small reversible action the participant could take."),
    maximumDays: z.number().int().min(1).max(7),
    maximumHours: z.number().nonnegative().describe("Must not exceed costCaps.hoursPerWeek."),
    maximumMoney: z.number().nonnegative().describe("Must not exceed costCaps.money."),
    currency: z.string().length(3).describe("Must equal costCaps.currency."),
  }),
  strengthensWhen: boundedText(300),
  weakensWhen: boundedText(300),
});
export type DraftRoute = z.infer<typeof draftRouteSchema>;

export const labAssistantDraftSchema = z.object({
  outcome: z
    .enum(["routes", "insufficient_signal"])
    .describe("routes when the confirmed words support three grounded directions; insufficient_signal when one focused follow-up question is the honest next step."),
  routes: z
    .array(draftRouteSchema)
    .max(3)
    .describe("Exactly one fresh route per kind listed in replaceKinds when outcome is routes; empty otherwise."),
  followUpQuestion: z
    .string()
    .max(300)
    .nullable()
    .describe("One focused question when outcome is insufficient_signal; null otherwise."),
  reasonRefs: z
    .array(refSchema)
    .max(5)
    .describe("Refs of the confirmed words that were too thin when outcome is insufficient_signal; empty otherwise."),
});
export type LabAssistantDraft = z.infer<typeof labAssistantDraftSchema>;

export const labAssistantErrorCodeSchema = z.enum([
  "PROVIDER_DISABLED",
  "MALFORMED_INPUT",
  "PROVIDER_FAILED",
  "TIMEOUT",
  "SCHEMA_FAILED",
  "GROUNDING_FAILED",
]);
export type LabAssistantErrorCode = z.infer<typeof labAssistantErrorCodeSchema>;

export const labAssistantOutcomeSchema = z.discriminatedUnion("outcome", [
  z.strictObject({
    outcome: z.literal("routes"),
    routes: z.tuple([routeSlotInputSchema, routeSlotInputSchema, routeSlotInputSchema]),
  }),
  z.strictObject({
    outcome: z.literal("insufficient_signal"),
    followUpQuestion: boundedText(300),
    reasonRefs: z.array(refSchema).min(1).max(5),
  }),
  z.strictObject({
    outcome: z.literal("error"),
    code: labAssistantErrorCodeSchema,
    message: z.string().min(1).max(300),
  }),
]);
export type LabAssistantOutcome = z.infer<typeof labAssistantOutcomeSchema>;
export type LabAssistantRoutesOutcome = Extract<LabAssistantOutcome, { outcome: "routes" }>;

export const labAssistantStatusSchema = z.strictObject({
  enabled: z.boolean(),
  label: z.string().min(1).max(120),
  provider: z.enum(["disabled", "openai_compatible", "fake"]),
});
export type LabAssistantStatus = z.infer<typeof labAssistantStatusSchema>;
