import type { SaveReflectionInput } from "../domain/commands";
import type { SaveReflectionResult } from "../domain/results";
import type { CommandKernel } from "../commands/command-kernel";

export interface ParticipantCommandAdapter {
  saveReflection(input: SaveReflectionInput): Promise<SaveReflectionResult>;
}

export function createParticipantCommandAdapter(
  kernel: CommandKernel,
): ParticipantCommandAdapter {
  return {
    saveReflection: (input) =>
      kernel.execute({
        name: "save_reflection",
        actor: "participant",
        input,
      }),
  };
}
