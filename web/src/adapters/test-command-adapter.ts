import type { SaveReflectionInput } from "../domain/commands";
import type { SaveReflectionResult } from "../domain/results";
import type { Actor } from "../domain/workspace";
import type { CommandKernel } from "../commands/command-kernel";

export interface TestCommandAdapter {
  saveReflection(input: SaveReflectionInput): SaveReflectionResult;
}

export function createTestCommandAdapter(
  kernel: CommandKernel,
  actor: Actor = "agent",
): TestCommandAdapter {
  return {
    saveReflection: (input) =>
      kernel.execute({
        name: "save_reflection",
        actor,
        input,
      }),
  };
}
