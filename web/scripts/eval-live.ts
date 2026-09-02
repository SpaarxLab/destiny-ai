export {};

const baseURL = process.env.OPENCODE_GO_BASE_URL?.replace(/\/$/, "") || "https://opencode.ai/zen/go/v1";
const apiKey = process.env.OPENCODE_GO_API_KEY?.trim();
const models = {
  dealer: process.env.ROLE_MODEL_DEALER || "glm-5.3-flash",
  reader: process.env.ROLE_MODEL_READER || "qwen3.8-flash",
  skeptic: process.env.ROLE_MODEL_SKEPTIC || "deepseek-v4-flash",
  routemaker: process.env.ROLE_MODEL_ROUTEMAKER || "gpt-5.6-luna",
  fallback: process.env.ROLE_MODEL_FALLBACK || "qwen3.8-flash",
  judge: process.env.ROLE_MODEL_JUDGE || "deepseek-v4-flash",
} as const;

async function main() {
  if (!apiKey) {
    console.error("OPENCODE_GO_API_KEY is not set. No network call was made.");
    process.exitCode = 2;
    return;
  }
  const unique = [...new Set(Object.values(models))];
  const results = await Promise.all(unique.map(async (model) => {
    const started = performance.now();
    try {
      const protocol = model === "qwen3.8-flash" ? "messages" : model === "gpt-5.6-luna" ? "responses" : "chat";
      const endpoint = protocol === "messages" ? "messages" : protocol === "responses" ? "responses" : "chat/completions";
      const body = protocol === "messages"
        ? { model, max_tokens: 80, messages: [{ role: "user", content: "Return only this JSON object: {\"ok\":true}" }] }
        : protocol === "responses"
          ? { model, input: "Return only this JSON object: {\"ok\":true}" }
          : { model, messages: [{ role: "user", content: "Return only this JSON object: {\"ok\":true}" }], response_format: { type: "json_object" }, temperature: 0 };
      const response = await fetch(`${baseURL}/${endpoint}`, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json", "user-agent": "destiny-ai-role-eval/1.0" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      const responseBody = await response.json() as { choices?: { message?: { content?: string } }[]; content?: { text?: string }[]; output?: { content?: { text?: string }[] }[]; error?: unknown };
      const content = responseBody.choices?.[0]?.message?.content ?? responseBody.content?.find((item) => typeof item.text === "string")?.text ?? responseBody.output?.flatMap((item) => item.content ?? []).find((item) => typeof item.text === "string")?.text ?? "";
      let validJson = false;
      const candidate = content.match(/\{[\s\S]*\}/)?.[0] ?? content;
      try { validJson = (JSON.parse(candidate) as { ok?: unknown }).ok === true; } catch { validJson = false; }
      return { model, ok: response.ok && validJson, status: response.status, validJson, latencyMs: Math.round(performance.now() - started) };
    } catch (error) {
      return { model, ok: false, status: 0, validJson: false, latencyMs: Math.round(performance.now() - started), error: error instanceof Error ? error.name : "UnknownError" };
    }
  }));
  console.table(results);
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

void main();
