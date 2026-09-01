import type { SaveReflectionInput } from "../domain/commands";
import type { SaveReflectionResult } from "../domain/results";
import type { Actor } from "../domain/workspace";
import type { CommandKernel } from "../commands/command-kernel";

export interface TestCommandAdapter {
  saveReflection(input: SaveReflectionInput): Promise<SaveReflectionResult>;
}

export function createTestCommandAdapter(
  kernel: CommandKernel,
  actor: Actor = "agent",
): TestCommandAdapter {
  return {
    saveReflection: (input) =>
      kernel.execute(
        actor === "participant"
          ? { actor: "participant", proposalSource: "participant" }
          : { actor: "agent", proposalSource: "chatgpt_webmcp" },
        {
        name: "save_reflection",
        input,
        },
      ),
  };
}
