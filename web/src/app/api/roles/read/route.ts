import { z } from "zod";
import { readerOutputSchema, READER_SYSTEM } from "../../../../inference/roles/reader";
import { isTensionClaim } from "../../../../inference/roles/checks";
import { handleRole } from "../../../../inference/roles/route-handler";

const input = z.strictObject({ swipes: z.array(z.strictObject({ ref: z.string(), cardText: z.string(), axis: z.string(), pole: z.string(), gesture: z.string(), dwell: z.string(), tappedReason: z.string().optional() })).min(3).max(20), existingTensions: z.array(z.string()).max(3) });
export function POST(request: Request): Promise<Response> {
  return handleRole(request, { role: "reader", inputSchema: input, outputSchema: readerOutputSchema, schemaName: "deck_tension", system: READER_SYSTEM, timeoutMs: 20_000, prompt: (value) => JSON.stringify(value), postCheck: (output) => output.outcome === "not_yet" || (!!output.tension && isTensionClaim(output.tension.claim)) });
}
