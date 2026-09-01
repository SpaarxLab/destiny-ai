import { z } from "zod";
import { proposeRouteSetInputSchema } from "../../domain/commands";
import type { JsonSchema } from "../runtime";

export const PROPOSE_ROUTE_SET_INPUT_SCHEMA = z.toJSONSchema(
  proposeRouteSetInputSchema,
  { target: "draft-7", io: "input", unrepresentable: "throw" },
) as JsonSchema;
