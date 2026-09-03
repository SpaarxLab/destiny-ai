import "server-only";

import { chargeDealerBudget } from "../../inference/roles/limits";

/** A match is about fifteen moves. Allow a few matches an hour per IP, and share the daily model budget. */
const MOVES_PER_HOUR = 400;
const HOUR = 60 * 60 * 1000;
const ESTIMATED_USD_PER_MOVE = 0.001;

type Counter = { windowStart: number; moves: number };
const counters = new Map<string, Counter>();

export function allowSparkMove(ip: string): { ok: true } | { ok: false; code: "RATE_LIMITED" | "BUDGET_EXHAUSTED"; retryAfterSeconds: number } {
  const now = Date.now();
  const previous = counters.get(ip);
  const counter = !previous || now - previous.windowStart >= HOUR ? { windowStart: now, moves: 0 } : previous;
  if (counter.moves >= MOVES_PER_HOUR) {
    return { ok: false, code: "RATE_LIMITED", retryAfterSeconds: Math.max(1, Math.ceil((counter.windowStart + HOUR - now) / 1000)) };
  }
  if (!chargeDealerBudget(ESTIMATED_USD_PER_MOVE).ok) return { ok: false, code: "BUDGET_EXHAUSTED", retryAfterSeconds: 3600 };
  counter.moves += 1;
  counters.set(ip, counter);
  return { ok: true };
}
