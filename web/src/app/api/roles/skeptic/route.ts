import { z } from "zod";
import { skepticOutputSchema, SKEPTIC_SYSTEM } from "../../../../inference/roles/skeptic";
import { isMoment } from "../../../../inference/roles/checks";
import { handleRole } from "../../../../inference/roles/route-handler";

const input = z.strictObject({ tension: z.strictObject({ ref: z.string(), claim: z.string(), axis: z.string(), proposedBy: z.unknown() }), swipes: z.array(z.unknown()).max(20) });
export function POST(request: Request): Promise<Response> {
  return handleRole(request, { role: "skeptic", inputSchema: input, outputSchema: skepticOutputSchema, schemaName: "deck_falsification", system: SKEPTIC_SYSTEM, timeoutMs: 20_000, prompt: (value) => JSON.stringify(value), postCheck: (output) => output.falsifications.every((card) => isMoment(card.text)) });
}
