import { z } from "zod";

export const STING_SCHEMA = 5;
export const START_CHIPS = 12;
export const EARN_CHIPS = 20;
export const MIN_DUELS = 5;
export const MAX_DUELS = 9;
export const SLOW_DWELL_MS = 2500;
export const MAX_LIFE_WORDS = 9;

export const axisSchema = z.enum([
  "autonomy_belonging",
  "depth_breadth",
  "making_deciding",
  "visible_hidden",
  "stability_risk",
  "people_things",
]);
export type Axis = z.infer<typeof axisSchema>;
export const AXES: readonly Axis[] = axisSchema.options;

export const poleSchema = z.enum(["a", "b"]);
export type Pole = z.infer<typeof poleSchema>;

export const sceneSchema = z.enum([
  "office",
  "kitchen",
  "classroom",
  "server",
  "beach",
  "desk",
  "stage",
  "phone",
  "road",
  "workshop",
  "home",
  "night",
]);
export type SceneTag = z.infer<typeof sceneSchema>;

export const playerSchema = z.enum(["house", "spark", "chatgpt", "rival"]);
export type Player = z.infer<typeof playerSchema>;

export const phaseSchema = z.enum(["door", "cast", "duel", "verdict", "fight", "lives", "dare", "card"]);
export type Phase = z.infer<typeof phaseSchema>;

export const lifeSchema = z.object({
  ref: z.string().min(1),
  line: z.string().min(1).max(80),
  scene: sceneSchema,
  axis: axisSchema,
  pole: poleSchema,
});
export type Life = z.infer<typeof lifeSchema>;

export const betSchema = z.object({
  pick: poleSchema,
  chips: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  because: z.string().min(1).max(80),
});
export type Bet = z.infer<typeof betSchema>;

export const probeSchema = z.object({
  ref: z.string().min(1),
  kind: z.enum(["cast", "duel"]),
  operationId: z.string().min(1),
  player: playerSchema,
  lives: z.array(lifeSchema).min(2).max(8),
  variable: z.string().max(40).optional(),
  testsLifeRef: z.string().optional(),
  bet: betSchema.optional(),
  commitment: z.string().optional(),
  stagedAt: z.number().int(),
  status: z.enum(["open", "answered"]),
});
export type Probe = z.infer<typeof probeSchema>;

export const reactionSchema = z.object({
  ref: z.string().min(1),
  probeRef: z.string().min(1),
  pick: poleSchema,
  pickedLifeRef: z.string().min(1),
  dwellMs: z.number().int().nonnegative(),
  betOutcome: z.enum(["hit", "miss", "none"]),
  chipsMoved: z.number().int(),
  corrected: z.boolean(),
  at: z.number().int(),
});
export type Reaction = z.infer<typeof reactionSchema>;

export const picksSchema = z.object({
  stings: z.array(z.string()).max(2),
  secret: z.string().optional(),
  secretSkipped: z.boolean(),
  dwell: z.record(z.string(), z.number().int().nonnegative()),
});
export type Picks = z.infer<typeof picksSchema>;

export const hypothesisKindSchema = z.enum(["cold_read", "hunger", "mask", "edge", "revision"]);
export type HypothesisKind = z.infer<typeof hypothesisKindSchema>;

export const hypothesisSchema = z.object({
  ref: z.string().min(1),
  kind: hypothesisKindSchema,
  text: z.string().min(1).max(160),
  proofRefs: z.array(z.string()),
  status: z.enum(["sealed", "proposed", "kept", "killed", "crowned", "burned", "revealed"]),
  commitment: z.string().optional(),
  revises: z.string().optional(),
  correction: z.string().max(120).optional(),
  /** False when the player had not earned the right to describe the person; the line is a draft the person may still keep or kill. */
  earned: z.boolean().default(true),
  player: playerSchema,
  at: z.number().int(),
});
export type Hypothesis = z.infer<typeof hypothesisSchema>;

export const killSchema = z.object({
  hypothesisRef: z.string(),
  text: z.string(),
  at: z.number().int(),
});
export type Kill = z.infer<typeof killSchema>;

export const fightSchema = z.object({
  refs: z.tuple([z.string(), z.string()]),
  status: z.enum(["open", "crowned"]),
  winner: z.string().optional(),
});
export type Fight = z.infer<typeof fightSchema>;

export const lifePosterSchema = z.object({
  ref: z.string().min(1),
  axis: axisSchema,
  pole: poleSchema,
  line: z.string().min(1).max(80),
  scene: sceneSchema,
  week: z.array(z.string()).min(3).max(7),
  tradeoff: z.string().max(140),
  question: z.string().max(140),
});
export type LifePoster = z.infer<typeof lifePosterSchema>;

export const dareSchema = z.object({
  ref: z.string().min(1),
  lifeRef: z.string().min(1),
  action: z.string().min(1).max(220),
  doneLooksLike: z.string().min(1).max(220),
  days: z.number().int().min(1).max(7),
  hours: z.number().nonnegative(),
  money: z.number().nonnegative(),
  currency: z.enum(["INR", "USD", "EUR", "GBP", "AED"]),
  source: z.object({ url: z.string().url(), excerpt: z.string().max(280) }).optional(),
  status: z.enum(["proposed", "accepted"]),
  acceptedAt: z.number().int().optional(),
  dueAt: z.string().optional(),
});
export type Dare = z.infer<typeof dareSchema>;

export const questionSchema = z.object({
  ref: z.string().min(1),
  player: playerSchema,
  text: z.string().min(1).max(120),
  options: z.tuple([z.string().min(1).max(60), z.string().min(1).max(60), z.string().min(1).max(60)]),
  choice: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  chipsCost: z.number().int().nonnegative(),
  askedAt: z.number().int(),
  answeredAt: z.number().int().optional(),
});
export type Question = z.infer<typeof questionSchema>;

/** A line the person wrote about themselves that every tool description must carry. */
export const ruleSchema = z.object({
  ref: z.string().min(1),
  text: z.string().min(1).max(120),
  source: z.enum(["kill", "you"]),
  at: z.number().int(),
});
export type Rule = z.infer<typeof ruleSchema>;

export const letterSealedSchema = z.object({
  willDo: z.boolean(),
  feeling: z.string().min(1).max(60),
  note: z.string().min(1).max(280),
});
/** The agent's sealed prediction about the person's real week. Hidden until the dare is due. */
export const letterSchema = z.object({
  ref: z.string().min(1),
  player: playerSchema,
  sealed: letterSealedSchema,
  commitment: z.string(),
  operationId: z.string(),
  sealedAt: z.number().int(),
  opensAt: z.string(),
  status: z.enum(["sealed", "opened"]),
  opened: z.object({ didIt: z.boolean(), feltLikeIt: z.boolean(), at: z.number().int(), outcome: z.enum(["hit", "miss"]), chipsMoved: z.number().int() }).optional(),
});
export type Letter = z.infer<typeof letterSchema>;

/** A line the player said to the person on the page, before or after a tap. Never carries a sealed pick. */
export const voiceSchema = z.object({ at: z.number().int(), player: playerSchema, text: z.string().min(1).max(140) });
export type Voice = z.infer<typeof voiceSchema>;

export const recordSchema = z.object({
  player: playerSchema,
  /** Which client the player spoke through, e.g. "ChatGPT desktop" or "Chrome 152". Set by the agent itself. */
  via: z.string().max(80).optional(),
  chips: z.number().int(),
  hits: z.number().int().nonnegative(),
  misses: z.number().int().nonnegative(),
  streak: z.number().int(),
  earned: z.boolean(),
  bust: z.boolean(),
});
export type Record_ = z.infer<typeof recordSchema>;

export const receiptSchema = z.object({
  seq: z.number().int().nonnegative(),
  operationId: z.string(),
  command: z.string(),
  stateVersion: z.number().int(),
  at: z.string(),
  summary: z.string(),
  prev: z.string(),
  hash: z.string(),
});
export type Receipt = z.infer<typeof receiptSchema>;

export const activitySchema = z.object({
  at: z.number().int(),
  who: z.enum(["you", "house", "spark", "chatgpt", "rival", "room"]),
  text: z.string(),
});
export type Activity = z.infer<typeof activitySchema>;

export const workspaceSchema = z.object({
  schema: z.literal(STING_SCHEMA),
  stateVersion: z.number().int().nonnegative(),
  createdAt: z.string(),
  settings: z.object({ timing: z.boolean(), sound: z.boolean() }),
  phase: phaseSchema,
  record: recordSchema,
  lives: z.array(lifeSchema),
  picks: picksSchema,
  probes: z.array(probeSchema),
  reactions: z.array(reactionSchema),
  hypotheses: z.array(hypothesisSchema),
  kills: z.array(killSchema),
  fight: fightSchema.optional(),
  posters: z.array(lifePosterSchema),
  chosenPoster: z.string().optional(),
  dare: dareSchema.optional(),
  brief: z.object({ text: z.string().min(1).max(2000), player: playerSchema, at: z.number().int() }).optional(),
  questions: z.array(questionSchema).default([]),
  rules: z.array(ruleSchema).default([]),
  voice: z.array(voiceSchema).default([]),
  letter: letterSchema.optional(),
  receipts: z.array(receiptSchema),
  activity: z.array(activitySchema),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export function freshWorkspace(now = new Date().toISOString()): Workspace {
  return {
    schema: STING_SCHEMA,
    stateVersion: 0,
    createdAt: now,
    settings: { timing: true, sound: false },
    phase: "door",
    record: { player: "house", chips: START_CHIPS, hits: 0, misses: 0, streak: 0, earned: false, bust: false },
    lives: [],
    picks: { stings: [], secretSkipped: false, dwell: {} },
    probes: [],
    reactions: [],
    hypotheses: [],
    kills: [],
    posters: [],
    questions: [],
    rules: [],
    voice: [],
    receipts: [],
    activity: [],
  };
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function lifeByRef(workspace: Workspace, ref: string): Life | undefined {
  for (const probe of workspace.probes) {
    const found = probe.lives.find((life) => life.ref === ref);
    if (found) return found;
  }
  return workspace.lives.find((life) => life.ref === ref);
}

export function answeredDuels(workspace: Workspace): Probe[] {
  return workspace.probes.filter((probe) => probe.kind === "duel" && probe.status === "answered");
}

export function openProbe(workspace: Workspace): Probe | undefined {
  return workspace.probes.find((probe) => probe.status === "open");
}

export const MAX_RULES = 6;
export const LETTER_STAKE = 3;
export const QUESTION_COST = 1;

/** What the player said at a given room version, if anything. */
export function voiceAt(workspace: Workspace, at: number): Voice | undefined {
  return [...workspace.voice].reverse().find((line) => line.at === at);
}

export function openQuestion(workspace: Workspace): Question | undefined {
  return workspace.questions.find((question) => question.choice === undefined);
}

/** Everything the person has ruled out, in their words: every kill and every rule they typed. */
export function rulesOfMe(workspace: Workspace): string[] {
  const lines = [...workspace.kills.map((kill) => `Never say "${kill.text}" or anything like it.`), ...workspace.rules.map((rule) => rule.text)];
  return lines.filter((line, index) => lines.indexOf(line) === index);
}

export function isEarned(record: Record_, reactions: readonly Reaction[]): boolean {
  const misses = reactions.filter((reaction) => reaction.betOutcome === "miss");
  return record.chips >= EARN_CHIPS && misses.length >= 1 && misses.every((reaction) => reaction.corrected);
}
