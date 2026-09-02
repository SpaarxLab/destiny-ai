import "server-only";

type Counter = { windowStart: number; deals: number; reads: number };
type DailyBudget = { day: string; estimatedUsd: number };
const counters = new Map<string, Counter>();
let dailyBudget: DailyBudget = { day: "", estimatedUsd: 0 };
const HOUR = 60 * 60 * 1000;

export function allowRoleRequest(ip: string, kind: "deal" | "read"): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  const previous = counters.get(ip);
  const counter = !previous || now - previous.windowStart >= HOUR ? { windowStart: now, deals: 0, reads: 0 } : previous;
  const maximum = kind === "deal" ? 30 : 10;
  const count = kind === "deal" ? counter.deals : counter.reads;
  if (count >= maximum) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((counter.windowStart + HOUR - now) / 1000)) };
  if (kind === "deal") counter.deals += 1; else counter.reads += 1;
  counters.set(ip, counter);
  return { ok: true };
}

export function requestIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "local";
}

export function chargeDealerBudget(estimatedUsd = 0.002): { ok: true } | { ok: false } {
  const cap = Number(process.env.DEALER_DAILY_BUDGET_USD ?? "3");
  const day = new Date().toISOString().slice(0, 10);
  if (dailyBudget.day !== day) dailyBudget = { day, estimatedUsd: 0 };
  if (!Number.isFinite(cap) || cap <= 0 || dailyBudget.estimatedUsd + estimatedUsd > cap) return { ok: false };
  dailyBudget.estimatedUsd += estimatedUsd;
  return { ok: true };
}
