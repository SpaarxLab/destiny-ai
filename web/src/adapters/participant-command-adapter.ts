import type {
  ChooseRouteInput,
  CompensateRouteSetInput,
  ProposeRouteSetInput,
  ReopenExploringInput,
  ReviseRouteSetInput,
  SaveReflectionInput,
  SetLimitsInput,
  SkipFollowUpInput,
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
  };
}
