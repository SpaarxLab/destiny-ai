import "server-only";

import { z } from "zod";

export type RoleName = "dealer" | "reader" | "skeptic" | "routemaker" | "judge";

const DEFAULT_MODELS: Record<RoleName, string> = {
  dealer: "qwen3.8-flash",
  reader: "qwen3.8-flash",
  skeptic: "deepseek-v4-flash",
  routemaker: "gpt-5.6-luna",
  judge: "deepseek-v4-flash",
};

export function modelFor(role: RoleName): { id: string } {
  const id = process.env[`ROLE_MODEL_${role.toUpperCase()}`]?.trim() || process.env.ROLE_MODEL_FALLBACK?.trim() || DEFAULT_MODELS[role];
  return { id };
}

export type RoleRun<T> =
  | { ok: true; value: T; model: string }
  | { ok: false; code: "PROVIDER_DISABLED" | "PROVIDER_FAILED" | "SCHEMA_FAILED" | "TIMEOUT"; model: string };

export async function runRole<T>(options: {
  role: RoleName;
  schema: z.ZodType<T>;
  schemaName: string;
  system: string;
  prompt: string;
  signal: AbortSignal;
}): Promise<RoleRun<T>> {
  if (process.env.EMBEDDED_ROLES !== "on" || !process.env.OPENCODE_GO_API_KEY?.trim()) {
    return { ok: false, code: "PROVIDER_DISABLED", model: modelFor(options.role).id };
  }
  const primary = modelFor(options.role);
  const fallbackId = process.env.ROLE_MODEL_FALLBACK?.trim() || "qwen3.8-flash";
  const fallback = fallbackId === primary.id ? null : { id: fallbackId };
  let lastModel = primary.id;
  for (const candidate of [primary, fallback].filter((value): value is { id: string } => value !== null)) {
    lastModel = candidate.id;
    try {
      const jsonSchema = JSON.stringify(z.toJSONSchema(options.schema));
      const text = await requestModelText(candidate.id, `${options.system}\nReturn only one valid JSON object matching this ${options.schemaName} JSON Schema. Do not use Markdown fences.\n${jsonSchema}`, options.prompt, options.signal);
      const candidateJson = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
      let decoded: unknown;
      try { decoded = JSON.parse(candidateJson); } catch { return { ok: false, code: "SCHEMA_FAILED", model: candidate.id }; }
      const parsed = options.schema.safeParse(decoded);
      if (!parsed.success) return { ok: false, code: "SCHEMA_FAILED", model: candidate.id };
      return { ok: true, value: parsed.data, model: candidate.id };
    } catch (error) {
      if (options.signal.aborted) return { ok: false, code: "TIMEOUT", model: candidate.id };
      if (candidate.id === fallbackId || fallback === null) {
        return { ok: false, code: /NoObjectGenerated|schema|parse/i.test(String(error)) ? "SCHEMA_FAILED" : "PROVIDER_FAILED", model: candidate.id };
      }
    }
  }
  return { ok: false, code: "PROVIDER_FAILED", model: lastModel };
}

async function requestModelText(id: string, system: string, prompt: string, signal: AbortSignal): Promise<string> {
  const baseURL = process.env.OPENCODE_GO_BASE_URL?.trim() || "https://opencode.ai/zen/go/v1";
  const apiKey = process.env.OPENCODE_GO_API_KEY?.trim() || "";
  const protocol = id.startsWith("qwen3.") ? "messages" : id === "gpt-5.6-luna" || id.startsWith("grok-") || id.startsWith("muse-") ? "responses" : "chat";
  const endpoint = protocol === "messages" ? "messages" : protocol === "responses" ? "responses" : "chat/completions";
  const body = protocol === "messages"
    ? { model: id, max_tokens: 700, thinking: { type: "disabled" }, system, messages: [{ role: "user", content: prompt }] }
    : protocol === "responses"
      ? { model: id, instructions: system, input: prompt, max_output_tokens: 700, reasoning: { effort: "low" } }
      : { model: id, messages: [{ role: "system", content: system }, { role: "user", content: prompt }], response_format: { type: "json_object" }, temperature: 0.7, max_tokens: 700, thinking: { type: "disabled" } };
  const response = await fetch(`${baseURL.replace(/\/$/, "")}/${endpoint}`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json", "user-agent": "destiny-ai-embedded-roles/1.0" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error(`provider_http_${response.status}`);
  const value = await response.json() as { choices?: { message?: { content?: string } }[]; content?: { text?: string }[]; output?: { content?: { text?: string }[] }[] };
  const text = value.choices?.[0]?.message?.content ?? value.content?.find((item) => typeof item.text === "string")?.text ?? value.output?.flatMap((item) => item.content ?? []).find((item) => typeof item.text === "string")?.text;
  if (!text) throw new Error("provider_empty_text");
  return text;
}
