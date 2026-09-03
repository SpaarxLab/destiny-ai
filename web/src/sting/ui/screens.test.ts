import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { freshWorkspace } from "../domain";
import { VerdictScreen } from "./screens";

describe("VerdictScreen", () => {
  it("renders an open question instead of verdict lines and actions", () => {
    const ws = freshWorkspace("2026-09-03T12:00:00.000Z");
    ws.phase = "verdict";
    ws.hypotheses.push({
      ref: "hyp-hunger",
      kind: "hunger",
      text: "To make useful things beside people you trust.",
      proofRefs: [],
      status: "proposed",
      earned: true,
      player: "house",
      at: 5,
    });
    ws.questions.push({
      ref: "q-open",
      player: "house",
      text: "Which part would you miss first?",
      options: ["Making", "The people", "The quiet"],
      chipsCost: 1,
      askedAt: 6,
    });

    const html = renderToStaticMarkup(createElement(VerdictScreen, {
      ws,
      act: async () => true,
      player: "house",
      playerLabel: "the house",
      thinking: null,
      ready: true,
    }));

    expect(html).toContain("Which part would you miss first?");
    expect(html).toContain("The people");
    expect(html).not.toContain("To make useful things beside people you trust.");
    expect(html).not.toContain("Keep what");
    expect(html).not.toContain("Not me:");
  });
});
