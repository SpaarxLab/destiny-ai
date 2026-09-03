import { requestIp } from "../../../../inference/roles/limits";
import { allowSparkMove } from "../../../../sting/spark/limits";
import { PLAYBOOK, movePrompt } from "../../../../sting/spark/prompt";
import { runSpark, sparkEnabled, sparkModel } from "../../../../sting/spark/provider";
import type { z } from "zod";
import { OUTPUT_SCHEMAS, moveRequestSchema, repairScenes } from "../../../../sting/spark/schemas";

const TIMEOUT_MS = 25_000;

export async function GET() {
  return json({ enabled: sparkEnabled(), model: sparkModel(), player: "spark", label: "Spark" }, 200);
}

export async function POST(request: Request) {
  if (!sparkEnabled()) return json({ ok: false, code: "PROVIDER_DISABLED" }, 404);
  const limit = allowSparkMove(requestIp(request));
  if (!limit.ok) return Response.json({ ok: false, code: limit.code }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(limit.retryAfterSeconds) } });
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, code: "MALFORMED_INPUT" }, 400);
  }
  const parsed = moveRequestSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, code: "MALFORMED_INPUT", fields: parsed.error.issues.slice(0, 4).map((issue) => issue.path.join(".")) }, 400);
  const { move, context, denial } = parsed.data;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const started = Date.now();
    const result = await runSpark({ schema: OUTPUT_SCHEMAS[move] as z.ZodType<unknown>, system: PLAYBOOK, prompt: movePrompt(move, context, denial), signal: controller.signal, repair: repairScenes });
    console.log(`[sting] ${move}${denial ? " (retry)" : ""} ${result.ok ? "ok" : `${result.code} ${result.detail ?? ""}`} ${Date.now() - started}ms`);
    if (!result.ok) return json(result, result.code === "TIMEOUT" ? 504 : 502);
    return json({ ok: true, move, value: result.value, model: result.model, ms: result.ms }, 200);
  } finally {
    clearTimeout(timeout);
  }
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
