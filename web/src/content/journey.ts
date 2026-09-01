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

export const JOURNEY_COPY = {
  promise: "You do not have to choose your whole career. Find one direction worth testing next.",
  intro:
    "A few focused questions will turn your own words into three different routes. None is a prediction or a ranking.",
  privacy: "Your work stays in this browser. You can leave and continue on this device.",
  start: "Start my journey",
  continue: "Continue",
  back: "Back",
  skip: "Skip for now",
  saveExit: "Save and exit",
  resume: "Continue my journey",
} as const;

export const STUCK_CHOICES: readonly StuckChoice[] = [
  {
    id: "too-many",
    title: "Too many paths",
    description: "Several directions appeal to me, and I cannot tell what deserves a real test.",
  },
  {
    id: "nothing-fits",
    title: "Nothing fits",
    description: "The options I can see feel flat, borrowed, or disconnected from what matters.",
  },
  {
    id: "safer-move",
    title: "I need a safer next move",
    description: "I want change, but time, money, stability, or energy make a leap feel risky.",
  },
  {
    id: "own-words",
    title: "I want to write it my way",
    description: "These shapes miss something important. I would rather begin with my own question.",
  },
] as const;

const BRANCH_QUESTIONS: Record<StuckShape, JourneyQuestion> = {
  "too-many": {
    id: "pull",
    eyebrow: "Notice the pull",
    prompt: "Which kind of work keeps pulling you back, even when you try to set it aside?",
    hint: "Name a task, problem, or moment—not a job title.",
    placeholder: "I keep returning to…",
  },
  "nothing-fits": {
    id: "worthwhile",
    eyebrow: "Find a real moment",
    prompt: "When did work last feel worthwhile, even for a short while?",
    hint: "Describe what you were doing and what made it matter.",
    placeholder: "It felt worthwhile when I…",
  },
  "safer-move": {
    id: "protect",
    eyebrow: "Protect what matters",
    prompt: "What must your next move protect?",
    hint: "Think about money, time, energy, care, identity, or stability.",
    placeholder: "My next move needs to protect…",
  },
  "own-words": {
    id: "own-question",
    eyebrow: "Begin in your words",
    prompt: "What question about work do you most want to untangle?",
    hint: "Write it as plainly or messily as you need.",
    placeholder: "The question I keep carrying is…",
  },
};

const SHARED_QUESTIONS: readonly JourneyQuestion[] = [
  {
    id: "small-signal",
    eyebrow: "Choose a useful signal",
    prompt: "What would you like to learn about yourself from one small test?",
    hint: "A useful answer can be felt or observed within a week.",
    placeholder: "I want to learn whether…",
  },
  {
    id: "safe-enough",
    eyebrow: "Keep it reversible",
    prompt: "What would make that test feel safe enough to try?",
    hint: "Add a boundary, or skip this if your earlier answer already says enough.",
    placeholder: "It would feel safe enough if…",
    skippable: true,
  },
] as const;

export function questionsFor(shape: StuckShape): readonly JourneyQuestion[] {
  return [BRANCH_QUESTIONS[shape], ...SHARED_QUESTIONS];
}

export const ROUTE_LABELS = {
  closest: {
    name: "Closest",
    description: "Build from something already present in your words.",
  },
  bridge: {
    name: "Bridge",
    description: "Combine what you know with one adjacent direction.",
  },
  probe: {
    name: "Probe",
    description: "Try a small departure without committing to it.",
  },
} as const;

export const MARK_PROMPTS = {
  draws: "What draws me in",
  worries: "What worries me",
  teaches: "What this could teach me",
} as const;
