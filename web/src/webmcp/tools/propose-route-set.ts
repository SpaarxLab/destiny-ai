import type { ProposeRouteSetInput } from "../../domain/commands";
import type { WebMcpCommandAdapter } from "../../adapters/webmcp-command-adapter";
import type { WorkspaceReader } from "../../projections/workspace-reader";
import { staleRegistrationResult } from "../contracts";
import type { WebMcpToolDefinition } from "../runtime";
import { PROPOSE_ROUTE_SET_INPUT_SCHEMA } from "../catalogue/propose-route-set-schema";

export const PROPOSE_ROUTE_SET_DESCRIPTION =
  "Propose exactly three grounded Destiny.AI route previews from confirmed participant quotes, or return one focused insufficient-signal follow-up. Use only while the workspace is exploring and no unresolved route set blocks a new proposal. Returns the authoritative typed result, including a proposal receipt when state changes; the participant alone may edit, reject, or choose a route.";

export function canRegisterProposeRouteSet(reader: WorkspaceReader): boolean {
  const orientation = reader.read({ view: "orientation" });
  return orientation.ok && orientation.nextActions.some((action) =>
    action.actor === "agent" && action.tool === "propose_route_set"
  );
}

export function createProposeRouteSetTool(
  adapter: WebMcpCommandAdapter,
  signal: AbortSignal,
  onWorkspaceChanged?: (stateVersion: number) => void,
): WebMcpToolDefinition {
  return {
    name: "propose_route_set",
    description: PROPOSE_ROUTE_SET_DESCRIPTION,
    inputSchema: PROPOSE_ROUTE_SET_INPUT_SCHEMA,
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    async execute(input: unknown) {
      if (signal.aborted) return staleRegistrationResult();
      const result = await adapter.proposeRouteSet(input as ProposeRouteSetInput);
      if (result.ok && result.receipt) onWorkspaceChanged?.(result.stateVersion);
      return result;
    },
  };
}
