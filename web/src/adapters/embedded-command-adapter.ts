import type { ProposeRouteSetInput } from "../domain/commands";
import type { ProposeRouteSetResult } from "../domain/results";
import type { CommandKernel } from "../commands/command-kernel";

/**
 * The optional embedded lab assistant proposes through the same command as ChatGPT and the
 * participant. It carries `embedded_inference` provenance and can never choose or revise.
 */
export interface EmbeddedCommandAdapter {
  proposeRouteSet(input: ProposeRouteSetInput): Promise<ProposeRouteSetResult>;
}

export function createEmbeddedCommandAdapter(kernel: CommandKernel): EmbeddedCommandAdapter {
  const context = { actor: "agent", proposalSource: "embedded_inference" } as const;
  return {
    proposeRouteSet: (input) => kernel.execute(context, { name: "propose_route_set", input }),
  };
}
