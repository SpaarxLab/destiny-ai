import "server-only";

import type { z } from "zod";
import { allowRoleRequest, chargeDealerBudget, requestIp } from "./limits";
import { runRole, type RoleName } from "./provider";

export async function handleRole<TInput, TOutput>(request: Request, options: {
  role: RoleName;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  schemaName: string;
  system: string;
  timeoutMs: number;
  prompt(input: TInput): string;
  postCheck?(output: TOutput): boolean;
}): Promise<Response> {
  if (process.env.EMBEDDED_ROLES !== "on") return json({ ok: false, code: "PROVIDER_DISABLED" }, 404);
  const limit = allowRoleRequest(requestIp(request), options.role === "dealer" ? "deal" : "read");
  if (!limit.ok) return Response.json({ ok: false, code: "RATE_LIMITED" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(limit.retryAfterSeconds) } });
  if (options.role === "dealer" && !chargeDealerBudget()) return json({ ok: false, code: "BUDGET_EXHAUSTED" }, 429);
  let raw: unknown;
  try { raw = await request.json(); } catch { return json({ ok: false, code: "MALFORMED_INPUT" }, 400); }
  const parsed = options.inputSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, code: "MALFORMED_INPUT", fields: parsed.error.issues.slice(0, 4).map((issue) => issue.path.join(".")) }, 400);
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const result = await runRole({ role: options.role, schema: options.outputSchema, schemaName: options.schemaName, system: options.system, prompt: options.prompt(parsed.data), signal: controller.signal });
    if (!result.ok) return json(result, result.code === "TIMEOUT" ? 504 : result.code === "PROVIDER_DISABLED" ? 404 : 502);
    if (options.postCheck && !options.postCheck(result.value)) return json({ ok: false, code: "QUALITY_FAILED", model: result.model }, 422);
    return json(result, 200);
  } finally { clearTimeout(timeout); }
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
