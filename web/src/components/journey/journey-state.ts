import type { StuckShape } from "../../content/journey";

export const JOURNEY_DRAFT_KEY = "destiny-ai.journey.v2";

export type JourneyScreen =
  | "welcome"
  | "shape"
  | "questions"
  | "confirm"
  | "limits"
  | "handoff"
  | "workshop"
  | "room"
  | "chosen";

export interface ConfirmedSource {
  answerId: string;
  reflectionRef: string;
  text: string;
}

export interface RouteNotes {
  draws: string;
  worries: string;
  teaches: string;
}

export interface JourneyLimits {
  hoursPerWeek: number;
  money: number;
  currency: string;
}

export interface ManualRouteDraft {
  title: string;
  premise: string;
  learningQuestion: string;
  testAction: string;
}

export interface JourneyDraft {
  screen: JourneyScreen;
  shape?: StuckShape;
  questionIndex: number;
  answers: Record<string, string>;
  /** Answers whose current text was drafted by an agent through the declarative form. */
  agentDrafted: Record<string, boolean>;
  limits?: JourneyLimits;
  /** operationId and the exact limits it was issued for, so a changed value gets a new id. */
  limitsOperation?: { operationId: string; limits: JourneyLimits };
  reflectionOperationIds: Record<string, string>;
  confirmedSources: ConfirmedSource[];
  routeOperationId?: string;
  routeRefs?: [string, string, string];
  routeDrafts: [ManualRouteDraft, ManualRouteDraft, ManualRouteDraft];
  notes: Record<string, RouteNotes>;
  /** Presentation-only detail for participant route actions, keyed by operationId. */
  activityDetails: Record<string, string>;
  assistantConsent: boolean;
}

export function emptyJourneyDraft(): JourneyDraft {
  return {
    screen: "welcome",
    questionIndex: 0,
    answers: {},
    agentDrafted: {},
    reflectionOperationIds: {},
    confirmedSources: [],
    routeDrafts: starterRouteDrafts(),
    notes: {},
    activityDetails: {},
    assistantConsent: false,
  };
}

const SCREENS: readonly JourneyScreen[] = [
  "welcome", "shape", "questions", "confirm", "limits", "handoff", "workshop", "room", "chosen",
];

export function parseJourneyDraft(raw: string | null): JourneyDraft {
  if (!raw) return emptyJourneyDraft();
  try {
    const value = JSON.parse(raw) as Partial<JourneyDraft>;
    if (
      !isRecord(value) ||
      !SCREENS.includes(value.screen as JourneyScreen) ||
      typeof value.questionIndex !== "number" ||
      !isRecord(value.answers) ||
      !isRecord(value.reflectionOperationIds) ||
      !Array.isArray(value.confirmedSources)
    ) {
      return emptyJourneyDraft();
    }
    return {
      ...emptyJourneyDraft(),
      ...value,
      answers: value.answers as Record<string, string>,
      agentDrafted: isRecord(value.agentDrafted) ? value.agentDrafted as Record<string, boolean> : {},
      reflectionOperationIds: value.reflectionOperationIds as Record<string, string>,
      confirmedSources: value.confirmedSources as ConfirmedSource[],
      routeDrafts: isRouteDraftTuple(value.routeDrafts) ? value.routeDrafts : starterRouteDrafts(),
      notes: isRecord(value.notes) ? value.notes as Record<string, RouteNotes> : {},
      activityDetails: isRecord(value.activityDetails) ? value.activityDetails as Record<string, string> : {},
      assistantConsent: value.assistantConsent === true,
    };
  } catch {
    return emptyJourneyDraft();
  }
}

export function answeredEntries(draft: JourneyDraft): Array<[string, string]> {
  return Object.entries(draft.answers).filter(([, text]) => text.trim().length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRouteDraftTuple(value: unknown): value is JourneyDraft["routeDrafts"] {
  return Array.isArray(value) && value.length === 3 && value.every((route) =>
    isRecord(route) &&
    ["title", "premise", "learningQuestion", "testAction"].every(
      (key) => typeof route[key] === "string",
    ));
}

export function starterRouteDrafts(): JourneyDraft["routeDrafts"] {
  return [
    {
      title: "Do more of what already pulls me",
      premise: "The nearest direction may be work I already return to without being pushed.",
      learningQuestion: "Does one real session of this work leave me with more energy than it took?",
      testAction: "Spend one short session doing the work, then write down what gave energy and what took it.",
    },
    {
      title: "Join what I know with something adjacent",
      premise: "A bridge may pair a skill I already have with a nearby problem I want to understand.",
      learningQuestion: "Is the combination more useful than either half alone?",
      testAction: "Sketch one tiny piece of work that needs both halves and show it to one person.",
    },
    {
      title: "Taste a less familiar direction",
      premise: "A careful probe may show whether a direction I have only imagined deserves a second step.",
      learningQuestion: "Does a low-stakes taste of this create curiosity strong enough for another step?",
      testAction: "Make one private sample of the unfamiliar work and record what surprised me.",
    },
  ];
}
