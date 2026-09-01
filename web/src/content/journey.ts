export type StuckShape = "too-many" | "nothing-fits" | "safer-move" | "own-words";

export interface StuckChoice {
  id: StuckShape;
  title: string;
  description: string;
}

export interface JourneyQuestion {
  id: string;
  eyebrow: string;
  prompt: string;
  hint: string;
  placeholder: string;
  skippable?: boolean;
}

export const COPY = {
  promise: "Find one direction worth testing next.",
  intro: "Three questions in your own words. Three routes to compare. One small test you choose.",
  privacy: "Everything stays in this browser.",
  start: "Start",
  continue: "Continue",
  back: "Back",
  skip: "Skip",
  startOver: "Start over",
  resume: "Continue where I left off",
  agentName: "ChatGPT",
  assistantName: "the lab assistant",
} as const;

export const STUCK_CHOICES: readonly StuckChoice[] = [
  {
    id: "too-many",
    title: "Too many paths",
    description: "Several directions appeal and none has had a real test.",
  },
  {
    id: "nothing-fits",
    title: "Nothing fits",
    description: "The options I can see feel flat or borrowed.",
  },
  {
    id: "safer-move",
    title: "I need a safer next move",
    description: "Time, money, or energy make a leap feel risky.",
  },
  {
    id: "own-words",
    title: "I would rather start with my own question",
    description: "These shapes miss something. Let me write it.",
  },
] as const;

const BRANCH_QUESTIONS: Record<StuckShape, JourneyQuestion> = {
  "too-many": {
    id: "pull",
    eyebrow: "Notice the pull",
    prompt: "Which kind of work keeps pulling you back?",
    hint: "A task or a moment, not a job title.",
    placeholder: "I keep returning to…",
  },
  "nothing-fits": {
    id: "worthwhile",
    eyebrow: "Find a real moment",
    prompt: "When did work last feel worthwhile, even briefly?",
    hint: "What were you doing, and what made it matter?",
    placeholder: "It felt worthwhile when I…",
  },
  "safer-move": {
    id: "protect",
    eyebrow: "Protect what matters",
    prompt: "What must your next move protect?",
    hint: "Money, time, energy, care, identity, or stability.",
    placeholder: "My next move needs to protect…",
  },
  "own-words": {
    id: "own-question",
    eyebrow: "Begin in your words",
    prompt: "What question about work do you most want to untangle?",
    hint: "As plain or as messy as you need.",
    placeholder: "The question I keep carrying is…",
  },
};

const SHARED_QUESTIONS: readonly JourneyQuestion[] = [
  {
    id: "small-signal",
    eyebrow: "Choose a useful signal",
    prompt: "What would you like to learn about yourself from one small test?",
    hint: "Something you could notice within a week.",
    placeholder: "I want to learn whether…",
  },
  {
    id: "safe-enough",
    eyebrow: "Keep it reversible",
    prompt: "What would make that test feel safe enough to try?",
    hint: "Optional. Add a boundary, or skip.",
    placeholder: "It would feel safe enough if…",
    skippable: true,
  },
] as const;

export function questionsFor(shape: StuckShape): readonly JourneyQuestion[] {
  return [BRANCH_QUESTIONS[shape], ...SHARED_QUESTIONS];
}

export function questionById(id: string): JourneyQuestion | undefined {
  return [...Object.values(BRANCH_QUESTIONS), ...SHARED_QUESTIONS].find((question) => question.id === id);
}

export const ROUTE_LABELS = {
  closest: { name: "Closest", description: "Builds on something already in your words." },
  bridge: { name: "Bridge", description: "Joins what you know with one adjacent direction." },
  probe: { name: "Probe", description: "A small departure without committing to it." },
} as const;

export const NOTE_PROMPTS = {
  draws: "What draws me in",
  worries: "What worries me",
  teaches: "What this could teach me",
} as const;

export const PROVENANCE_LABELS = {
  chatgpt_webmcp: "Proposed by ChatGPT",
  participant: "Drafted by you",
  embedded_inference: "Drafted by the lab assistant",
} as const;

export const ACTOR_NAMES = {
  chatgpt_webmcp: "ChatGPT",
  participant: "You",
  embedded_inference: "The lab assistant",
} as const;
