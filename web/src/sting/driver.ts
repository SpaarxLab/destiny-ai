import { QUESTION_COST, answeredDuels, openProbe, openQuestion, type Workspace } from "./domain";
import { houseBrief, houseCast, houseColdRead, houseCorrection, houseDare, houseLetter, houseNextDuel, housePosters, houseQuestion, houseShouldClose, houseVerdict } from "./house";
import type { PendingMove } from "./kernel";

/**
 * The house's next move for the current room, or null when it is the person's turn.
 * Pure: the caller assigns the operationId and executes.
 */
export function houseMove(ws: Workspace): PendingMove | null {
  const base = { expectedVersion: ws.stateVersion, player: "house" as const };
  switch (ws.phase) {
    case "cast":
      if (!ws.probes.some((probe) => probe.kind === "cast")) return { ...base, type: "cast", lives: houseCast() };
      return null;

    case "duel": {
      if (!ws.hypotheses.some((item) => item.kind === "cold_read")) {
        return { ...base, type: "propose_hypothesis", kind: "cold_read", text: houseColdRead(ws) };
      }
      const last = ws.reactions.at(-1);
      if (last && last.betOutcome === "miss" && !last.corrected) {
        const { text, correction } = houseCorrection(ws, last);
        return { ...base, type: "propose_hypothesis", kind: "revision", text, revises: last.ref, correction };
      }
      if (openProbe(ws) || openQuestion(ws)) return null;
      // One paid question, asked once the taps have had a chance to disagree.
      if (ws.questions.length === 0 && answeredDuels(ws).length === 3 && ws.record.chips > QUESTION_COST + 2 && !ws.record.bust) {
        const question = houseQuestion(ws);
        if (question) return { ...base, type: "ask_once", ...question };
      }
      if (houseShouldClose(ws)) return { ...base, type: "close_duels" };
      const duel = houseNextDuel(ws);
      if (!duel) return { ...base, type: "close_duels" };
      const { operationId: _ignored, ...rest } = duel;
      void _ignored;
      return { ...rest, expectedVersion: ws.stateVersion } as PendingMove;
    }

    case "verdict": {
      const has = (kind: string) => ws.hypotheses.some((item) => item.kind === kind && item.status !== "killed");
      const verdict = houseVerdict(ws);
      const hungers = ws.hypotheses.filter((item) => item.kind === "hunger" && item.status !== "killed");
      if (hungers.length === 0) return { ...base, type: "propose_hypothesis", kind: "hunger", text: verdict.hunger.text, proofRefs: verdict.hunger.proofRefs };
      // Another player wrote the verdict: the house never mixes its voice into it. Optional lines stay absent.
      if (hungers.some((item) => item.player !== "house") && has("edge")) return null;
      if (hungers.length === 1 && verdict.hunger2 && verdict.hunger2.text !== hungers[0].text && !ws.kills.some((kill) => kill.text === verdict.hunger2!.text)) {
        return { ...base, type: "propose_hypothesis", kind: "hunger", text: verdict.hunger2.text, proofRefs: verdict.hunger2.proofRefs };
      }
      if (!has("mask") && verdict.mask && !ws.kills.some((kill) => kill.text === verdict.mask!.text)) {
        return { ...base, type: "propose_hypothesis", kind: "mask", text: verdict.mask.text, proofRefs: verdict.mask.proofRefs };
      }
      if (!has("edge") && !ws.kills.some((kill) => kill.text === verdict.edge.text)) {
        return { ...base, type: "propose_hypothesis", kind: "edge", text: verdict.edge.text, proofRefs: verdict.edge.proofRefs };
      }
      return null;
    }

    case "fight": {
      if (ws.fight) return null;
      const hungers = ws.hypotheses.filter((item) => item.kind === "hunger" && item.status === "kept");
      if (hungers.length < 2) return null;
      return { ...base, type: "stage_fight", refs: [hungers[0].ref, hungers[1].ref] };
    }

    case "lives":
      if (ws.posters.length === 0) return { ...base, type: "stage_lives", posters: housePosters(ws) };
      return null;

    case "dare": {
      if (ws.dare) return null;
      const dare = houseDare(ws);
      return dare ? { ...base, type: "propose_dare", dare } : null;
    }

    case "card": {
      if (!ws.brief) return { ...base, type: "write_brief", text: houseBrief(ws) };
      if (ws.dare?.status === "accepted" && !ws.letter && !ws.record.bust) {
        const letter = houseLetter(ws);
        return { ...base, type: "seal_letter", ...letter };
      }
      return null;
    }

    default:
      return null;
  }
}

/** True when the house has said everything it can on this screen and the person must act. */
export function houseIsDone(ws: Workspace): boolean {
  return houseMove(ws) === null;
}
