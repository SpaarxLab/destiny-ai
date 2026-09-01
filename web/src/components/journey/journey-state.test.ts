import { describe, expect, it } from "vitest";
import { STUCK_CHOICES, questionsFor } from "../../content/journey";
import { answeredEntries, emptyJourneyDraft, parseJourneyDraft } from "./journey-state";
import { highlightSegments } from "../room/words-panel";

describe("Destiny Journey configuration", () => {
  it.each(STUCK_CHOICES.map((choice) => [choice.id]))(
    "%s keeps the same three-question depth",
    (shape) => {
      const questions = questionsFor(shape);
      expect(questions).toHaveLength(3);
      expect(questions[0]?.id).toBeTruthy();
      expect(questions[1]?.id).toBe("small-signal");
      expect(questions[2]).toMatchObject({ id: "safe-enough", skippable: true });
      expect(questions.slice(0, 2).every((question) => !question.skippable)).toBe(true);
    },
  );

  it("restores a saved screen and preserves only written answers as sources", () => {
    const saved = {
      ...emptyJourneyDraft(),
      screen: "questions" as const,
      shape: "own-words" as const,
      questionIndex: 1,
      answers: {
        "own-question": "What work lets me think and help?",
        "small-signal": "",
      },
    };

    const restored = parseJourneyDraft(JSON.stringify(saved));
    expect(restored).toMatchObject({ screen: "questions", shape: "own-words", questionIndex: 1 });
    expect(answeredEntries(restored)).toEqual([
      ["own-question", "What work lets me think and help?"],
    ]);
  });

  it("falls back safely when local draft bytes are malformed", () => {
    expect(parseJourneyDraft("not-json")).toEqual(emptyJourneyDraft());
    expect(parseJourneyDraft(JSON.stringify({ screen: "routes" }))).toEqual(emptyJourneyDraft());
  });
});

describe("grounding highlights", () => {
  it("marks every exact quoted substring and merges overlaps", () => {
    const text = "I keep returning to making complicated work easier to understand.";
    expect(highlightSegments(text, ["making complicated work", "complicated work easier"])).toEqual([
      { text: "I keep returning to ", marked: false },
      { text: "making complicated work easier", marked: true },
      { text: " to understand.", marked: false },
    ]);
    expect(highlightSegments(text, ["not present"])).toEqual([{ text, marked: false }]);
  });
});
