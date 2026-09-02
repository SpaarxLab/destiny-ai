import type { DealCardsInput, PostDealerNoteInput, ProposePortraitInput, ProposeRouteSetInput, ProposeTensionInput, SaveReflectionInput } from "../domain/commands";
import type { DealCardsResult, PostDealerNoteResult, ProposePortraitResult, ProposeRouteSetResult, ProposeTensionResult, SaveReflectionResult } from "../domain/results";
import type { AgentIdentity } from "../domain/workspace";
import type { CommandKernel } from "../commands/command-kernel";

export interface WebMcpCommandAdapter {
  saveReflection(input: SaveReflectionInput): Promise<SaveReflectionResult>;
  proposeRouteSet(input: ProposeRouteSetInput): Promise<ProposeRouteSetResult>;
  dealCards(input: DealCardsInput, identity?: AgentIdentity): Promise<DealCardsResult>;
  proposeTension(input: ProposeTensionInput, identity?: AgentIdentity): Promise<ProposeTensionResult>;
  proposePortrait(input: ProposePortraitInput, identity?: AgentIdentity): Promise<ProposePortraitResult>;
  postDealerNote(input: PostDealerNoteInput, identity?: AgentIdentity): Promise<PostDealerNoteResult>;
}

export function createWebMcpCommandAdapter(kernel: CommandKernel): WebMcpCommandAdapter {
  const defaultIdentity: AgentIdentity = { source: "chatgpt_webmcp", role: "unspecified", label: "ChatGPT" };
  const contextFor = (identity: AgentIdentity = defaultIdentity) => ({ actor: "agent" as const, proposalSource: identity.source, agentIdentity: identity });
  return {
    saveReflection: (input) => kernel.execute(contextFor(), { name: "save_reflection", input }),
    proposeRouteSet: (input) => kernel.execute(contextFor(), { name: "propose_route_set", input }),
    dealCards: (input, identity) => kernel.execute(contextFor(identity), { name: "deal_cards", input }) as Promise<DealCardsResult>,
    proposeTension: (input, identity) => kernel.execute(contextFor(identity), { name: "propose_tension", input }) as Promise<ProposeTensionResult>,
    proposePortrait: (input, identity) => kernel.execute(contextFor(identity), { name: "propose_portrait", input }) as Promise<ProposePortraitResult>,
    postDealerNote: (input, identity) => kernel.execute(contextFor(identity), { name: "post_dealer_note", input }) as Promise<PostDealerNoteResult>,
  };
}
