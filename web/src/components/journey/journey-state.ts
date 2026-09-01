import type { StuckShape } from "../../content/journey";

export const JOURNEY_DRAFT_KEY = "destiny-ai.journey.p3b.v1";

export type JourneyScreen =
  | "welcome"
  | "shape"
  | "questions"
  | "confirm"
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
  routeOperationId?: string;
  routeRefs?: [string, string, string];
  marks: Record<string, RouteMarks>;
}

export function emptyJourneyDraft(): JourneyDraft {
  return {
    screen: "welcome",
    questionIndex: 0,
    confirmIndex: 0,
    answers: {},
    reflectionOperationIds: {},
    confirmedSources: [],
    marks: {},
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
      marks: value.marks as Record<string, RouteMarks>,
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
    "welcome", "shape", "questions", "confirm", "workshop", "routes", "chosen",
    "all-rejected", "saved",
  ].includes(String(value));
}
