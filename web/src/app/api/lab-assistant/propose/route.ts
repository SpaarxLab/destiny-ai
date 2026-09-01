import { draftRouteProposal } from "../../../../inference/lab-assistant";
import { selectLabAssistantProvider } from "../../../../inference/providers";
import { labAssistantInputSchema, type LabAssistantOutcome } from "../../../../inference/schemas";

/**
 * Server-only proposal drafting for the embedded lab assistant (D-014).
 *
 * - Refuses with 403 while the provider is disabled.
 * - Validates the body against the bounded input schema; nothing else is read from the request.
 * - Never persists, never logs participant text, and never writes to the workspace: the browser
 *   submits any returned proposal through the command kernel as an embedded_inference proposal.
 */
export async function POST(request: Request): Promise<Response> {
  const selection = selectLabAssistantProvider();
  if (!selection.enabled) {
    return respond({
      outcome: "error",
      code: "PROVIDER_DISABLED",
      message: "The lab assistant is disabled on this server. The WebMCP path is unaffected.",
    }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond({ outcome: "error", code: "MALFORMED_INPUT", message: "The request body must be JSON." }, 400);
  }

  const parsed = labAssistantInputSchema.safeParse(body);
  if (!parsed.success) {
    const paths = parsed.error.issues.slice(0, 4).map((issue) => issue.path.map(String).join(".") || "input");
    return respond({
      outcome: "error",
      code: "MALFORMED_INPUT",
      message: `The request does not match the lab assistant input contract (${paths.join(", ")}).`,
    }, 400);
  }

  const outcome = await draftRouteProposal(parsed.data, selection.instance);
  const status = outcome.outcome !== "error" ? 200 : outcome.code === "TIMEOUT" ? 504 : 502;
  return respond(outcome, status);
}

function respond(outcome: LabAssistantOutcome, status: number): Response {
  return Response.json(outcome, { status, headers: { "Cache-Control": "no-store" } });
}
