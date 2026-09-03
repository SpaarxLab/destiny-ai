import { describe, expect, it } from "vitest";
import { freshWorkspace } from "./domain";
import { migrate } from "./store";

const duelLives = [
  { ref: "a", line: "A quiet workshop before sunrise.", scene: "workshop" as const, axis: "autonomy_belonging" as const, pole: "a" as const },
  { ref: "b", line: "A shared workshop before sunrise.", scene: "workshop" as const, axis: "autonomy_belonging" as const, pole: "b" as const },
];

describe("STING saved-room migration", () => {
  it("reconstructs missing schema-5 player authority from the players who actually contributed", () => {
    for (const player of ["chatgpt", "house"] as const) {
      const legacy = structuredClone(freshWorkspace());
      legacy.phase = "duel";
      legacy.hypotheses.push({
        ref: `cold-${player}`,
        kind: "cold_read",
        text: "Wants a room that still needs them.",
        proofRefs: [],
        status: "revealed",
        earned: true,
        player,
        at: 1,
      });
      const legacyRecord = legacy.record as { players?: unknown; externalAllowed?: unknown };
      delete legacyRecord.players;
      delete legacyRecord.externalAllowed;

      const migrated = migrate(legacy);
      expect(migrated.record.players).toEqual([player]);
      expect(migrated.record.externalAllowed).toBe(player === "chatgpt");
    }
  });

  it("fails closed to inspect-only when a legacy room is already past the agent-play phases", () => {
    const legacy = freshWorkspace();
    legacy.phase = "card";
    legacy.hypotheses.push({
      ref: "cold-chatgpt",
      kind: "cold_read",
      text: "Wants a room that still needs them.",
      proofRefs: [],
      status: "revealed",
      earned: true,
      player: "chatgpt",
      at: 1,
    });
    const legacyRecord = legacy.record as { players?: unknown; externalAllowed?: unknown };
    delete legacyRecord.players;
    delete legacyRecord.externalAllowed;
    const migrated = migrate(legacy);
    expect(migrated.record.players).toEqual(["chatgpt"]);
    expect(migrated.record.externalAllowed).toBe(false);
  });

  it("preserves an already-upgraded schema-5 room unchanged", () => {
    const room = freshWorkspace("2026-09-03T12:00:00.000Z");
    room.record.players = ["chatgpt"];
    room.record.externalAllowed = false;
    expect(migrate(room)).toEqual(room);
  });

  it("recompiles legacy model-authored and pre-boundary house briefs", () => {
    for (const brief of [
      { text: "WHAT I KEPT CHOOSING\nA model-authored legacy brief.", player: "chatgpt" as const, at: 4 },
      { text: "FIELD BRIEF\nAn older house template.", player: "house" as const, at: 4 },
    ]) {
      const legacy = freshWorkspace("2026-09-03T12:00:00.000Z");
      legacy.phase = "card";
      legacy.brief = brief;
      expect(migrate(legacy).brief).toBeUndefined();
    }

    const current = freshWorkspace("2026-09-03T12:00:00.000Z");
    current.phase = "card";
    current.brief = { text: "FIELD BRIEF — GAME-DERIVED CLAIMS ARE REVISABLE EVIDENCE.\nYOUR SIGNAL\nCurrent.", player: "house", at: 4 };
    expect(migrate(current).brief).toEqual(current.brief);
  });

  it("fails closed when a legacy room contains any duel without the promised cold read", () => {
    for (const status of ["open", "answered"] as const) {
      const legacy = freshWorkspace();
      legacy.phase = "duel";
      legacy.stateVersion = 9;
      legacy.probes.push({
        ref: `duel-legacy-${status}`,
        kind: "duel",
        operationId: `legacy-operation-${status}`,
        player: "chatgpt",
        lives: duelLives,
        variable: "alone or shared",
        testsLifeRef: "a",
        bet: { pick: "a", chips: 1, because: "A legacy guess." },
        stagedAt: 8,
        status,
      });

      const migrated = migrate(legacy);
      expect(migrated.phase).toBe("door");
      expect(migrated.stateVersion).toBe(0);
      expect(migrated.probes).toEqual([]);
      expect(migrated.receipts).toEqual([]);
    }
  });

  it("fails closed when a legacy room contains a question without the promised cold read", () => {
    const legacy = freshWorkspace();
    legacy.phase = "duel";
    legacy.questions.push({
      ref: "question-legacy",
      player: "chatgpt",
      text: "Which morning would you keep?",
      options: ["Alone", "Together", "Neither"],
      choice: 0,
      chipsCost: 1,
      askedAt: 4,
      answeredAt: 5,
    });
    const migrated = migrate(legacy);
    expect(migrated.phase).toBe("door");
    expect(migrated.questions).toEqual([]);
  });

  it("starts fresh for documents from an unknown schema", () => {
    const migrated = migrate({ schema: 4, stateVersion: 99, phase: "card" });
    expect(migrated.phase).toBe("door");
    expect(migrated.stateVersion).toBe(0);
  });
});
