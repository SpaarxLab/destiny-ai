import type { DealCardsInput, PostDealerNoteInput, ProposePortraitInput, ProposeRouteSetInput, ProposeTensionInput } from "../domain/commands";
import type { DealCardsResult, PostDealerNoteResult, ProposePortraitResult, ProposeRouteSetResult, ProposeTensionResult } from "../domain/results";
import type { AgentIdentity } from "../domain/workspace";
import type { CommandKernel } from "../commands/command-kernel";

/**
 * The optional embedded lab assistant proposes through the same command as ChatGPT and the
 * participant. It carries `embedded_inference` provenance and can never choose or revise.
 */
export interface EmbeddedCommandAdapter {
  proposeRouteSet(input: ProposeRouteSetInput): Promise<ProposeRouteSetResult>;
  dealCards(input: DealCardsInput, identity: AgentIdentity): Promise<DealCardsResult>;
  proposeTension(input: ProposeTensionInput, identity: AgentIdentity): Promise<ProposeTensionResult>;
  proposePortrait(input: ProposePortraitInput, identity: AgentIdentity): Promise<ProposePortraitResult>;
  postDealerNote(input: PostDealerNoteInput, identity: AgentIdentity): Promise<PostDealerNoteResult>;
}

export function createEmbeddedCommandAdapter(kernel: CommandKernel): EmbeddedCommandAdapter {
  const context = { actor: "agent", proposalSource: "embedded_inference" } as const;
  const withIdentity = (agentIdentity: AgentIdentity) => ({ ...context, agentIdentity });
  return {
    proposeRouteSet: (input) => kernel.execute(context, { name: "propose_route_set", input }),
    dealCards: (input, identity) => kernel.execute(withIdentity(identity), { name: "deal_cards", input }) as Promise<DealCardsResult>,
    proposeTension: (input, identity) => kernel.execute(withIdentity(identity), { name: "propose_tension", input }) as Promise<ProposeTensionResult>,
    proposePortrait: (input, identity) => kernel.execute(withIdentity(identity), { name: "propose_portrait", input }) as Promise<ProposePortraitResult>,
    postDealerNote: (input, identity) => kernel.execute(withIdentity(identity), { name: "post_dealer_note", input }) as Promise<PostDealerNoteResult>,
  };
}
