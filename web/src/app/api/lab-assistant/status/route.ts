import { selectLabAssistantProvider } from "../../../../inference/providers";
import type { LabAssistantStatus } from "../../../../inference/schemas";

/**
 * Server-only status for the embedded lab assistant (D-014). Reports whether a proposal source is
 * configured and how it is labelled; it reveals no keys, base URLs, or model names.
 */
export async function GET(): Promise<Response> {
  const selection = selectLabAssistantProvider();
  const status: LabAssistantStatus = {
    enabled: selection.enabled,
    label: selection.label,
    provider: selection.provider,
  };
  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
}
