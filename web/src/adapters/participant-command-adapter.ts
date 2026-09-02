import type {
  ChooseRouteInput,
  CompensateRouteSetInput,
  ProposeRouteSetInput,
  ReopenExploringInput,
  ReviseRouteSetInput,
  SaveReflectionInput,
  SetLimitsInput,
  SkipFollowUpInput,
  DismissDealInput,
  DismissNoteInput,
  ReopenDeckInput,
  ResolvePortraitInput,
  ResolveTensionInput,
  SetDeckSettingsInput,
  SwipeCardInput,
} from "../domain/commands";
import type {
  ChooseRouteResult,
  CompensateRouteSetResult,
  ProposeRouteSetResult,
  ReopenExploringResult,
  ReviseRouteSetResult,
  SaveReflectionResult,
  SetLimitsResult,
  SkipFollowUpResult,
  DismissDealResult,
  DismissNoteResult,
  ReopenDeckResult,
  ResolvePortraitResult,
  ResolveTensionResult,
  SetDeckSettingsResult,
  SwipeCardResult,
} from "../domain/results";
import type { CommandKernel } from "../commands/command-kernel";

export interface ParticipantCommandAdapter {
  saveReflection(input: SaveReflectionInput): Promise<SaveReflectionResult>;
  setLimits(input: SetLimitsInput): Promise<SetLimitsResult>;
  proposeRouteSet(input: ProposeRouteSetInput): Promise<ProposeRouteSetResult>;
  reviseRouteSet(input: ReviseRouteSetInput): Promise<ReviseRouteSetResult>;
  chooseRoute(input: ChooseRouteInput): Promise<ChooseRouteResult>;
  compensateRouteSet(input: CompensateRouteSetInput): Promise<CompensateRouteSetResult>;
  skipFollowUp(input: SkipFollowUpInput): Promise<SkipFollowUpResult>;
  reopenExploring(input: ReopenExploringInput): Promise<ReopenExploringResult>;
  dismissDeal(input: DismissDealInput): Promise<DismissDealResult>;
  swipeCard(input: SwipeCardInput): Promise<SwipeCardResult>;
  setDeckSettings(input: SetDeckSettingsInput): Promise<SetDeckSettingsResult>;
  resolveTension(input: ResolveTensionInput): Promise<ResolveTensionResult>;
  resolvePortrait(input: ResolvePortraitInput): Promise<ResolvePortraitResult>;
  dismissNote(input: DismissNoteInput): Promise<DismissNoteResult>;
  reopenDeck(input: ReopenDeckInput): Promise<ReopenDeckResult>;
}

const context = { actor: "participant", proposalSource: "participant" } as const;

export function createParticipantCommandAdapter(
  kernel: CommandKernel,
): ParticipantCommandAdapter {
  return {
    saveReflection: (input) => kernel.execute(context, { name: "save_reflection", input }),
    setLimits: (input) => kernel.execute(context, { name: "set_limits", input }),
    proposeRouteSet: (input) => kernel.execute(context, { name: "propose_route_set", input }),
    reviseRouteSet: (input) => kernel.execute(context, { name: "revise_route_set", input }),
    chooseRoute: (input) => kernel.execute(context, { name: "choose_route", input }),
    compensateRouteSet: (input) => kernel.execute(context, { name: "compensate_route_set", input }),
    skipFollowUp: (input) => kernel.execute(context, { name: "skip_follow_up", input }),
    reopenExploring: (input) => kernel.execute(context, { name: "reopen_exploring", input }),
    dismissDeal: (input) => kernel.execute(context, { name: "dismiss_deal", input }) as Promise<DismissDealResult>,
    swipeCard: (input) => kernel.execute(context, { name: "swipe_card", input }) as Promise<SwipeCardResult>,
    setDeckSettings: (input) => kernel.execute(context, { name: "set_deck_settings", input }) as Promise<SetDeckSettingsResult>,
    resolveTension: (input) => kernel.execute(context, { name: "resolve_tension", input }) as Promise<ResolveTensionResult>,
    resolvePortrait: (input) => kernel.execute(context, { name: "resolve_portrait", input }) as Promise<ResolvePortraitResult>,
    dismissNote: (input) => kernel.execute(context, { name: "dismiss_note", input }) as Promise<DismissNoteResult>,
    reopenDeck: (input) => kernel.execute(context, { name: "reopen_deck", input }) as Promise<ReopenDeckResult>,
  };
}
