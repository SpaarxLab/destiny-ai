import { z } from "zod";
import { axisSchema, poleSchema, sceneSchema } from "../domain";

/** Everything the player is allowed to see. Built on the client from the room; sealed things of *other* players never enter it. */
export const playerContextSchema = z.object({
  phase: z.string(),
  locale: z.string().max(12),
  hour: z.number().int().min(0).max(23),
  record: z.object({ chips: z.number().int(), hits: z.number().int(), misses: z.number().int(), earned: z.boolean(), bust: z.boolean() }),
  lives: z.array(z.object({ ref: z.string(), line: z.string(), axis: axisSchema, pole: poleSchema })).max(8),
  picks: z.object({
    stings: z.array(z.object({ ref: z.string(), line: z.string(), dwell: z.enum(["fast", "medium", "slow", "off"]) })).max(2),
    secret: z.object({ ref: z.string(), line: z.string(), dwell: z.enum(["fast", "medium", "slow", "off"]) }).optional(),
    secretSkipped: z.boolean(),
  }),
  duels: z.array(z.object({
    reactionRef: z.string(),
    testsLifeRef: z.string().optional(),
    a: z.string(),
    b: z.string(),
    axis: axisSchema,
    variable: z.string(),
    myBet: z.object({ pick: poleSchema, chips: z.number().int(), because: z.string() }),
    picked: poleSchema,
    pickedLine: z.string(),
    outcome: z.enum(["hit", "miss"]),
    dwell: z.enum(["fast", "medium", "slow", "off"]),
    corrected: z.boolean(),
  })).max(12),
  untested: z.array(z.object({ ref: z.string(), line: z.string(), axis: axisSchema, pole: poleSchema })).max(3),
  coldRead: z.string().optional(),
  lines: z.array(z.object({ kind: z.string(), text: z.string(), status: z.string() })).max(12),
  killed: z.array(z.string()).max(12),
  crowned: z.string().optional(),
  chosenLife: z.object({ line: z.string(), axis: axisSchema, pole: poleSchema }).optional(),
  dare: z.object({ action: z.string(), doneLooksLike: z.string(), days: z.number(), hours: z.number(), money: z.number(), currency: z.string() }).optional(),
  questions: z.array(z.object({ text: z.string(), answer: z.string().nullable() })).max(3).default([]),
  /** Moves the room allows the player right now (duel phase only). */
  allowed: z.array(z.enum(["duel", "question", "close"])).max(3).default([]),
  rulesOfMe: z.array(z.string().max(200)).max(20).default([]),
  letter: z.object({ status: z.string(), opensAt: z.string() }).optional(),
});
export type PlayerContext = z.infer<typeof playerContextSchema>;

export const moveKindSchema = z.enum(["cast", "cold_read", "duel", "correction", "verdict", "lives", "dare", "brief", "question", "letter", "turn"]);
export type MoveKind = z.infer<typeof moveKindSchema>;

const nineWords = z.string().min(3).max(80);
/** One line the player says to the person on the page. Optional everywhere; never a sealed pick. */
const aside = z.string().min(1).max(140).optional();

export const castOutputSchema = z.object({
  lives: z.array(z.object({ line: nineWords, scene: sceneSchema, axis: axisSchema, pole: poleSchema })).length(8),
  aside,
});

export const coldReadOutputSchema = z.object({ text: z.string().min(3).max(90) });

export const duelOutputSchema = z.object({
  testsLifeRef: z.string(),
  axis: axisSchema,
  variable: z.string().min(3).max(40),
  a: z.object({ line: nineWords, scene: sceneSchema }),
  b: z.object({ line: nineWords, scene: sceneSchema }),
  bet: z.object({ pick: poleSchema, chips: z.union([z.literal(1), z.literal(2), z.literal(3)]), because: z.string().min(3).max(80) }),
  aside,
});

export const correctionOutputSchema = z.object({
  text: z.string().min(3).max(120),
  correction: z.string().min(3).max(120),
});

const claim = z.object({ text: z.string().min(3).max(120), proofRefs: z.array(z.string()).max(8) });
export const verdictOutputSchema = z.object({
  hunger: claim,
  hunger2: claim.optional(),
  mask: claim.optional(),
  edge: claim,
});

export const livesOutputSchema = z.object({
  posters: z.array(z.object({
    line: nineWords,
    scene: sceneSchema,
    axis: axisSchema,
    pole: poleSchema,
    week: z.array(z.string().min(3).max(120)).min(3).max(4),
    tradeoff: z.string().min(3).max(140),
    question: z.string().min(3).max(140),
  })).length(3),
});

export const dareOutputSchema = z.object({
  action: z.string().min(3).max(220),
  doneLooksLike: z.string().min(3).max(220),
  days: z.number().int().min(1).max(7),
  hours: z.number().min(0).max(6),
  money: z.number().min(0).max(2000),
  currency: z.enum(["INR", "USD", "EUR", "GBP", "AED"]),
});

export const briefOutputSchema = z.object({ brief: z.string().min(40).max(1400) });

export const questionOutputSchema = z.object({
  text: z.string().min(5).max(120),
  options: z.tuple([z.string().min(1).max(60), z.string().min(1).max(60), z.string().min(1).max(60)]),
  aside,
});

export const letterOutputSchema = z.object({
  willDo: z.boolean(),
  feeling: z.string().min(1).max(60),
  note: z.string().min(10).max(280),
  aside,
});

/**
 * The captain's turn during the duels: Spark chooses its own move from what the room allows right now.
 * The kernel still denies anything illegal; a denial comes back once as feedback, then the house plays.
 */
export const turnOutputSchema = z.discriminatedUnion("move", [
  z.object({ move: z.literal("duel") }).extend(duelOutputSchema.shape),
  z.object({ move: z.literal("question") }).extend(questionOutputSchema.shape),
  z.object({ move: z.literal("close"), aside }),
]);

export const OUTPUT_SCHEMAS = {
  cast: castOutputSchema,
  cold_read: coldReadOutputSchema,
  duel: duelOutputSchema,
  correction: correctionOutputSchema,
  verdict: verdictOutputSchema,
  lives: livesOutputSchema,
  dare: dareOutputSchema,
  brief: briefOutputSchema,
  question: questionOutputSchema,
  letter: letterOutputSchema,
  turn: turnOutputSchema,
} as const;

export type MoveOutput = {
  cast: z.infer<typeof castOutputSchema>;
  cold_read: z.infer<typeof coldReadOutputSchema>;
  duel: z.infer<typeof duelOutputSchema>;
  correction: z.infer<typeof correctionOutputSchema>;
  verdict: z.infer<typeof verdictOutputSchema>;
  lives: z.infer<typeof livesOutputSchema>;
  dare: z.infer<typeof dareOutputSchema>;
  brief: z.infer<typeof briefOutputSchema>;
  question: z.infer<typeof questionOutputSchema>;
  letter: z.infer<typeof letterOutputSchema>;
  turn: z.infer<typeof turnOutputSchema>;
};

export const moveRequestSchema = z.object({
  move: moveKindSchema,
  context: playerContextSchema,
  denial: z.string().max(300).optional(),
});
export type MoveRequest = z.infer<typeof moveRequestSchema>;

const SCENE_HINTS: Array<[RegExp, string]> = [
  [/kitchen|cook|chai|food|cafe|restaurant/i, "kitchen"],
  [/class|school|teach|student|lecture/i, "classroom"],
  [/server|data|rack|code|terminal|lab/i, "server"],
  [/beach|sea|shore|coast|sand/i, "beach"],
  [/stage|crowd|concert|mic|audience|spotlight/i, "stage"],
  [/phone|call|text|screen|chat/i, "phone"],
  [/road|street|highway|travel|train|bus|airport|market/i, "road"],
  [/workshop|garage|studio|craft|tool|factory/i, "workshop"],
  [/home|house|porch|flat|room|bed|family/i, "home"],
  [/night|dark|midnight|late|3 ?a\.?m/i, "night"],
  [/office|meeting|boardroom|corporate/i, "office"],
];

const VALID_SCENES = new Set(sceneSchema.options as readonly string[]);

function repairScene(value: unknown): string {
  const raw = String(value ?? "");
  if (VALID_SCENES.has(raw)) return raw;
  for (const [pattern, scene] of SCENE_HINTS) if (pattern.test(raw)) return scene;
  return "desk";
}

/** Model output sometimes invents scene tags. Map them onto the twelve we can draw before validating. */
export function repairScenes(decoded: unknown): unknown {
  if (!decoded || typeof decoded !== "object") return decoded;
  const value = decoded as Record<string, unknown>;
  for (const key of ["a", "b"]) {
    const side = value[key];
    if (side && typeof side === "object" && "scene" in (side as object)) (side as Record<string, unknown>).scene = repairScene((side as Record<string, unknown>).scene);
  }
  for (const key of ["lives", "posters"]) {
    const list = value[key];
    if (Array.isArray(list)) for (const item of list) if (item && typeof item === "object" && "scene" in item) (item as Record<string, unknown>).scene = repairScene((item as Record<string, unknown>).scene);
  }
  return value;
}
