import type { ProposeRouteSetInput, SaveReflectionInput } from "../domain/commands";
import type { ProposeRouteSetResult, SaveReflectionResult } from "../domain/results";
import type { CommandKernel } from "../commands/command-kernel";

export interface WebMcpCommandAdapter {
  saveReflection(input: SaveReflectionInput): Promise<SaveReflectionResult>;
  proposeRouteSet(input: ProposeRouteSetInput): Promise<ProposeRouteSetResult>;
}

export function createWebMcpCommandAdapter(kernel: CommandKernel): WebMcpCommandAdapter {
  const context = { actor: "agent", proposalSource: "chatgpt_webmcp" } as const;
  return {
    saveReflection: (input) => kernel.execute(context, { name: "save_reflection", input }),
    proposeRouteSet: (input) => kernel.execute(context, { name: "propose_route_set", input }),
  };
}
