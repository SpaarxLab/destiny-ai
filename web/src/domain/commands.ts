import { z } from "zod";
import { actorSchema } from "./workspace";

export const writeControlSchema = z.strictObject({
  operationId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
});

export const saveReflectionInputSchema = writeControlSchema.extend({
  text: z.string().trim().min(1).max(2_000),
});
export type SaveReflectionInput = z.infer<typeof saveReflectionInputSchema>;

export const saveReflectionCommandSchema = z.strictObject({
  name: z.literal("save_reflection"),
  actor: actorSchema,
  input: saveReflectionInputSchema,
});
export type SaveReflectionCommand = z.infer<typeof saveReflectionCommandSchema>;

export type Command = SaveReflectionCommand;

export function reflectionRequestIdentity(command: SaveReflectionCommand): string {
  return JSON.stringify({
    name: command.name,
    actor: command.actor,
    text: command.input.text,
  });
}
