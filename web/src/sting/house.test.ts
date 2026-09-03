import { describe, expect, it } from "vitest";
import { nearDuplicate } from "./content";
import { freshWorkspace } from "./domain";
import { firstPerson, houseBrief, housePosters } from "./house";
import { StingKernel } from "./kernel";
import { MemoryStore } from "./store";

describe("firstPerson", () => {
  it("uses subject pronouns at the start of a model-written line", () => {
    expect(firstPerson("You make difficult systems work quietly.", "edge")).toBe(
      "I make difficult systems work quietly.",
    );
  });

  it("handles curly-apostrophe subject contractions", () => {
    expect(firstPerson("You’re steady under pressure.", "edge")).toBe("I’m steady under pressure.");
    expect(firstPerson("You’ve made the difficult thing work.", "edge")).toBe("I’ve made the difficult thing work.");
    expect(firstPerson("You’ll choose the quiet room.", "hunger")).toBe("I’ll choose the quiet room.");
    expect(firstPerson("You’d rather build alone.", "mask")).toBe("I’d rather build alone.");
  });

  it("preserves ambiguous agent prose as quoted evidence", () => {
    expect(firstPerson("Keeping every door open protects you from choosing the wrong one.", "mask")).toBe(
      "A story I want challenged: “Keeping every door open protects you from choosing the wrong one.”",
    );
  });

  it("does not risk rewriting multiple pronouns with a grammar heuristic", () => {
    expect(firstPerson("You build the fix, but you still ask what could fail.", "edge")).toBe(
      "I kept this strength: “You build the fix, but you still ask what could fail.”",
    );
  });

  it("keeps relative clauses verbatim", () => {
    expect(firstPerson("The work you do protects what you value and protects you from noise.", "edge")).toBe(
      "I kept this strength: “The work you do protects what you value and protects you from noise.”",
    );
  });

  it("keeps comparison clauses verbatim", () => {
    expect(firstPerson("You hold steady craft through late nights better than you admit.", "edge")).toBe(
      "I kept this strength: “You hold steady craft through late nights better than you admit.”",
    );
  });

  it("keeps object-control verbs verbatim", () => {
    expect(firstPerson("Freedom lets you make things.", "edge")).toBe(
      "I kept this strength: “Freedom lets you make things.”",
    );
  });

  it("keeps the infinitive in a want", () => {
    expect(firstPerson("To be in the room when it clicks.", "hunger")).toBe("I want to be in the room when it clicks.");
  });

  it("rewrites a leading want and its people-relative pronoun naturally", () => {
    expect(firstPerson("You want to build useful things beside people you trust.", "hunger")).toBe(
      "I want to build useful things beside people I trust.",
    );
  });

  it("quotes an infinitive when rewriting its pronouns would be unsafe", () => {
    expect(firstPerson("To build something that still needs you back.", "hunger")).toBe(
      "I kept this want: “To build something that still needs you back.”",
    );
  });

  it("builds a complete brief without doubled punctuation or unsafe dare rewrites", () => {
    const ws = freshWorkspace("2026-09-03T12:00:00.000Z");
    ws.hypotheses.push(
      { ref: "edge-1", kind: "edge", text: "You build difficult systems quietly", proofRefs: [], status: "kept", earned: true, player: "chatgpt", at: 1 },
      { ref: "mask-1", kind: "mask", text: "Keeping every door open protects you from choosing.", proofRefs: [], status: "kept", earned: true, player: "chatgpt", at: 2 },
    );
    ws.dare = {
      ref: "dare-1",
      lifeRef: "poster-1",
      action: "Leave your phone at home.",
      doneLooksLike: "You have a photo from the walk.",
      days: 7,
      hours: 2,
      money: 0,
      currency: "INR",
      status: "accepted",
      acceptedAt: 3,
      dueAt: "2026-09-10T12:00:00.000Z",
    };
    ws.lives.push({ ref: "slow-life", line: "A slow choice.", scene: "desk", axis: "depth_breadth", pole: "a" });
    ws.reactions.push({ ref: "slow-reaction", probeRef: "slow-probe", pick: "a", pickedLifeRef: "slow-life", dwellMs: 3000, betOutcome: "none", chipsMoved: 0, corrected: false, at: 4 });
    ws.posters.push({
      ref: "poster-1",
      axis: "visible_hidden",
      pole: "b",
      line: "The work matters without applause.",
      scene: "workshop",
      week: ["Day one", "Day two", "Day three"],
      tradeoff: "applause or reality",
      question: "Can reality replace applause as the judge?",
    });
    ws.chosenPoster = "poster-1";

    const brief = houseBrief(ws);
    expect(brief).toContain("I build difficult systems quietly. I may undersell it");
    expect(brief).toContain("This week I will run this accepted test: “Leave your phone at home.”");
    expect(brief).toContain("Done looks like: “You have a photo from the walk.” Due Thursday 10 Sept.");
    expect(brief).toContain("I slowed down around “A slow choice”. Do not solve that tension for me");
    expect(brief).toContain("The question underneath it: “Can reality replace applause as the judge?”");
    expect(brief).toContain("HOW TO HELP ME");
    expect(brief).not.toContain(".”.");
    expect(brief).not.toContain("?.”");
    expect(brief.length).toBeLessThanOrEqual(2000);
  });

  it("routes around a killed line instead of deadlocking deterministic posters", async () => {
    const ws = freshWorkspace("2026-09-03T12:00:00.000Z");
    ws.phase = "lives";
    ws.kills.push({ hypothesisRef: "killed-alone", text: "To be alone with a hard problem.", at: 1 });
    const posters = housePosters(ws);
    expect(posters).toHaveLength(3);
    expect(new Set(posters.map((poster) => poster.axis)).size).toBe(3);
    const lines = posters.flatMap((poster) => [poster.line, ...poster.week, poster.tradeoff, poster.question]);
    expect(lines.some((line) => nearDuplicate(ws.kills[0].text, line))).toBe(false);

    const result = await new StingKernel(new MemoryStore(ws)).execute("house", { type: "stage_lives", operationId: "kill-safe-posters", expectedVersion: 0, player: "house", posters });
    expect(result.ok).toBe(true);
  });
});
