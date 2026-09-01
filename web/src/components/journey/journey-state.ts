import type { StuckShape } from "../../content/journey";

export const JOURNEY_DRAFT_KEY = "destiny-ai.journey.p3b.v1";

export type JourneyScreen =
  | "welcome"
  | "shape"
  | "questions"
  | "confirm"
  | "boundaries"
  | "workshop"
  | "routes"
  | "chosen"
  | "all-rejected"
  | "saved";

export interface ConfirmedSource {
  answerId: string;
  reflectionRef: string;
  text: string;
}

export interface RouteMarks {
  draws: string;
  worries: string;
  teaches: string;
}

export interface JourneyCaps {
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
  resumeScreen?: JourneyScreen;
  shape?: StuckShape;
  startedShape?: StuckShape;
  questionIndex: number;
  confirmIndex: number;
  answers: Record<string, string>;
  reflectionOperationIds: Record<string, string>;
  confirmedSources: ConfirmedSource[];
  caps?: JourneyCaps;
  routeOperationId?: string;
  routeRefs?: [string, string, string];
  routeDrafts: [ManualRouteDraft, ManualRouteDraft, ManualRouteDraft];
  workshopReviewed: boolean;
  marks: Record<string, RouteMarks>;
  reviewedRoutes: Record<string, boolean>;
  hasComparedRoutes: boolean;
}

export function emptyJourneyDraft(): JourneyDraft {
  return {
    screen: "welcome",
    questionIndex: 0,
    confirmIndex: 0,
    answers: {},
    reflectionOperationIds: {},
    confirmedSources: [],
    routeDrafts: starterRouteDrafts(),
    workshopReviewed: false,
    marks: {},
    reviewedRoutes: {},
    hasComparedRoutes: false,
  };
}

export function parseJourneyDraft(raw: string | null): JourneyDraft {
  if (!raw) return emptyJourneyDraft();

  try {
    const value = JSON.parse(raw) as Partial<JourneyDraft>;
    if (
      !value || typeof value !== "object" ||
      !isScreen(value.screen) ||
      typeof value.questionIndex !== "number" ||
      typeof value.confirmIndex !== "number" ||
      !isRecord(value.answers) ||
      !isRecord(value.reflectionOperationIds) ||
      !Array.isArray(value.confirmedSources) ||
      !isRecord(value.marks)
    ) {
      return emptyJourneyDraft();
    }

    return {
      ...emptyJourneyDraft(),
      ...value,
      answers: value.answers as Record<string, string>,
      reflectionOperationIds: value.reflectionOperationIds as Record<string, string>,
      confirmedSources: value.confirmedSources as ConfirmedSource[],
      routeDrafts: isRouteDraftTuple(value.routeDrafts)
        ? value.routeDrafts
        : starterRouteDrafts(),
      workshopReviewed: value.workshopReviewed === true,
      marks: value.marks as Record<string, RouteMarks>,
      reviewedRoutes: isRecord(value.reviewedRoutes)
        ? value.reviewedRoutes as Record<string, boolean>
        : {},
      hasComparedRoutes: value.hasComparedRoutes === true,
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

function isScreen(value: unknown): value is JourneyScreen {
  return [
    "welcome", "shape", "questions", "confirm", "boundaries", "workshop", "routes", "chosen",
    "all-rejected", "saved",
  ].includes(String(value));
}

function isRouteDraftTuple(value: unknown): value is JourneyDraft["routeDrafts"] {
  return Array.isArray(value) && value.length === 3 && value.every((route) =>
    isRecord(route) &&
    ["title", "premise", "learningQuestion", "testAction"].every(
      (key) => typeof route[key] === "string",
    ));
}

function starterRouteDrafts(): JourneyDraft["routeDrafts"] {
  return [
    {
      title: "Build on work that already pulls me",
      premise: "A nearby direction may be worth testing through work I already return to without being pushed.",
      learningQuestion: "Does doing one real piece of this work create enough energy to repeat it?",
      testAction: "Spend one short session doing the work, then note what gave or took energy.",
    },
    {
      title: "Bridge what I know with something adjacent",
      premise: "A bridge may pair something I can already do with a nearby problem I want to understand.",
      learningQuestion: "Does combining these two parts feel more useful than pursuing either alone?",
      testAction: "Sketch one tiny piece of work that combines both parts and review it privately.",
    },
    {
      title: "Probe a less familiar direction",
      premise: "A careful probe may show whether a less familiar direction deserves more attention.",
      learningQuestion: "Does a low-stakes taste of this direction create curiosity strong enough for a second step?",
      testAction: "Make one private sample or simulation of the unfamiliar work and record what surprised me.",
    },
  ];
}
