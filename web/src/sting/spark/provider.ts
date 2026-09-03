import "server-only";

import type { z } from "zod";

export const DEFAULT_SPARK_MODEL = "muse-spark-1.3-contributor";

export function sparkModel(): string {
  return process.env.STING_PLAYER_MODEL?.trim() || DEFAULT_SPARK_MODEL;
}

export function sparkEnabled(): boolean {
  return process.env.STING_PLAYER !== "off" && Boolean(process.env.OPENCODE_GO_API_KEY?.trim());
}

export type SparkRun<T> =
  | { ok: true; value: T; model: string; ms: number }
  | { ok: false; code: "PROVIDER_DISABLED" | "PROVIDER_FAILED" | "SCHEMA_FAILED" | "TIMEOUT"; model: string; detail?: string };

export async function runSpark<T>(options: { schema: z.ZodType<T>; system: string; prompt: string; signal: AbortSignal; repair?: (decoded: unknown) => unknown }): Promise<SparkRun<T>> {
  const model = sparkModel();
  if (!sparkEnabled()) return { ok: false, code: "PROVIDER_DISABLED", model };
  const started = Date.now();
  try {
    const text = await requestResponses(model, options.system, options.prompt, options.signal);
    const candidate = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
    let decoded: unknown;
    try {
      decoded = JSON.parse(candidate);
    } catch {
      return { ok: false, code: "SCHEMA_FAILED", model, detail: "not json" };
    }
    const parsed = options.schema.safeParse(options.repair ? options.repair(decoded) : decoded);
    if (!parsed.success) return { ok: false, code: "SCHEMA_FAILED", model, detail: parsed.error.issues.slice(0, 3).map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") };
    return { ok: true, value: parsed.data, model, ms: Date.now() - started };
  } catch (error) {
    if (options.signal.aborted) return { ok: false, code: "TIMEOUT", model };
    const cause = (error as { cause?: { code?: string; message?: string } }).cause;
    return { ok: false, code: "PROVIDER_FAILED", model, detail: `${String(error)}${cause ? ` (${cause.code ?? ""} ${cause.message ?? ""})` : ""}`.slice(0, 160) };
  }
}

async function requestResponses(model: string, instructions: string, input: string, signal: AbortSignal): Promise<string> {
  const baseURL = (process.env.OPENCODE_GO_BASE_URL?.trim() || "https://opencode.ai/zen/go/v1").replace(/\/$/, "");
  const apiKey = process.env.OPENCODE_GO_API_KEY?.trim() || "";
  const request = () =>
    fetch(`${baseURL}/responses`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "user-agent": "sting-player/1.0" },
      body: JSON.stringify({ model, instructions, input, max_output_tokens: 1800, reasoning: { effort: "minimal" } }),
      signal,
    });
  let response: Response;
  try {
    response = await request();
  } catch (error) {
    // A cold DNS lookup or a dropped socket shows up as "fetch failed"; one retry is cheap and usually enough.
    if (signal.aborted || !/fetch failed/i.test(String(error))) throw error;
    await new Promise((resolve) => setTimeout(resolve, 600));
    response = await request();
  }
  if (!response.ok) throw new Error(`provider_http_${response.status}`);
  const value = (await response.json()) as { output?: { content?: { text?: string }[] }[]; error?: { message?: string } };
  if (value.error) throw new Error(value.error.message ?? "provider_error");
  const text = value.output?.flatMap((item) => item.content ?? []).find((item) => typeof item.text === "string")?.text;
  if (!text) throw new Error("provider_empty_text");
  return text;
}
