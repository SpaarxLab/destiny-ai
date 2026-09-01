import type {
  ChooseRouteInput,
  CompensateRouteSetInput,
  ProposeRouteSetInput,
  ReviseRouteSetInput,
  SaveReflectionInput,
} from "../domain/commands";
import type {
  ChooseRouteResult,
  CompensateRouteSetResult,
  ProposeRouteSetResult,
  ReviseRouteSetResult,
  SaveReflectionResult,
} from "../domain/results";
import type { CommandKernel } from "../commands/command-kernel";

export interface ParticipantCommandAdapter {
  saveReflection(input: SaveReflectionInput): Promise<SaveReflectionResult>;
  proposeRouteSet(input: ProposeRouteSetInput): Promise<ProposeRouteSetResult>;
  reviseRouteSet(input: ReviseRouteSetInput): Promise<ReviseRouteSetResult>;
  chooseRoute(input: ChooseRouteInput): Promise<ChooseRouteResult>;
  compensateRouteSet(input: CompensateRouteSetInput): Promise<CompensateRouteSetResult>;
}

export function createParticipantCommandAdapter(
  kernel: CommandKernel,
): ParticipantCommandAdapter {
  return {
    saveReflection: (input) =>
      kernel.execute({ actor: "participant", proposalSource: "participant" }, {
        name: "save_reflection",
        input,
      }),
    proposeRouteSet: (input) =>
      kernel.execute({ actor: "participant", proposalSource: "participant" }, {
        name: "propose_route_set",
        input,
      }),
    reviseRouteSet: (input) =>
      kernel.execute({ actor: "participant", proposalSource: "participant" }, {
        name: "revise_route_set",
        input,
      }),
    chooseRoute: (input) =>
      kernel.execute({ actor: "participant", proposalSource: "participant" }, {
        name: "choose_route",
        input,
      }),
    compensateRouteSet: (input) =>
      kernel.execute({ actor: "participant", proposalSource: "participant" }, {
        name: "compensate_route_set",
        input,
      }),
  };
}
