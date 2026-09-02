import { z } from "zod";
import { dealerOutputSchema, DEALER_SYSTEM } from "../../../../inference/roles/dealer";
import { isMoment } from "../../../../inference/roles/checks";
import { handleRole } from "../../../../inference/roles/route-handler";

const input = z.strictObject({ piles: z.record(z.string(), z.array(z.unknown())), dealtTexts: z.array(z.string()).max(40), slots: z.number().int().min(1).max(5), wanted: z.enum(["opening", "duel", "reversal", "any"]) });
export function POST(request: Request): Promise<Response> {
  return handleRole(request, { role: "dealer", inputSchema: input, outputSchema: dealerOutputSchema, schemaName: "deck_deal", system: DEALER_SYSTEM, timeoutMs: 20_000, prompt: (value) => JSON.stringify(value), postCheck: (output) => output.cards.every((card) => isMoment(card.text)) });
}
