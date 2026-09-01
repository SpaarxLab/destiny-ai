import type { ProposeRouteSetInput } from "../../domain/commands";
import type { ProposeRouteSetResult } from "../../domain/results";
import type { AvailableAction, RouteProposalSet } from "../../domain/workspace";
import type { WebMcpCommandAdapter } from "../../adapters/webmcp-command-adapter";
import type { WorkspaceReader } from "../../projections/workspace-reader";
import {
  staleRegistrationResult,
  webMcpProposeRouteSetResultSchema,
  type WebMcpProposeRouteSetResult,
} from "../contracts";
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

export function canRegisterProposeRouteSetReplay(reader: WorkspaceReader): boolean {
  const orientation = reader.read({ view: "orientation" });
  return orientation.ok && orientation.data?.view === "orientation" &&
    orientation.data.identity.phase === "EXPLORING" &&
    orientation.data.active.routeSet?.status === "proposed" &&
    orientation.data.active.routeSet.createdBy === "chatgpt_webmcp";
}

export function createProposeRouteSetTool(
  adapter: WebMcpCommandAdapter,
  reader: WorkspaceReader,
  signal: AbortSignal,
  options: Readonly<{
    replayOnly?: boolean;
    replayableOperationIds?: ReadonlySet<string>;
    onProposalCommitted?: (operationId: string) => void;
    onWorkspaceChanged?: (stateVersion: number) => void;
    onWorkspaceSyncError?: (error: unknown, stateVersion: number) => void;
  }> = {},
): WebMcpToolDefinition {
  return {
    name: "propose_route_set",
    description: PROPOSE_ROUTE_SET_DESCRIPTION,
    inputSchema: PROPOSE_ROUTE_SET_INPUT_SCHEMA,
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    async execute(input: unknown) {
      if (signal.aborted) {
        return webMcpProposeRouteSetResultSchema.parse(staleRegistrationResult());
      }
      const operationId = operationIdFrom(input);
      if (
        options.replayOnly &&
        (!operationId || !options.replayableOperationIds?.has(operationId))
      ) {
        return replayOnlyDenial(reader);
      }
      const result = await adapter.proposeRouteSet(input as ProposeRouteSetInput);
      const publicResult = serializeProposeRouteSetResult(result);
      if (publicResult.ok && "receipt" in publicResult) {
        options.onProposalCommitted?.(publicResult.receipt.operationId);
        notifyWorkspaceChanged(
          publicResult.stateVersion,
          options.onWorkspaceChanged,
          options.onWorkspaceSyncError,
        );
      }
      return publicResult;
    },
  };
}

function operationIdFrom(input: unknown): string | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const operationId = (input as Record<string, unknown>).operationId;
  return typeof operationId === "string" ? operationId : null;
}

function replayOnlyDenial(reader: WorkspaceReader): WebMcpProposeRouteSetResult {
  const current = reader.read({ view: "orientation" });
  return webMcpProposeRouteSetResultSchema.parse({
    ok: false,
    error: {
      code: "WRONG_LIFECYCLE",
      what: "An unresolved route set already exists; this registration accepts exact replay only.",
      retry: "NEVER",
      insteadDo: "Do not submit a new proposal. Reread the workspace and wait for the participant decision.",
    },
    nextActions: [],
    stateVersion: current.stateVersion,
    guidance: "No state changed because this registration is available only to recover a prior receipt.",
  });
}

export function serializeProposeRouteSetResult(
  result: ProposeRouteSetResult,
): WebMcpProposeRouteSetResult {
  const nextActions = agentActions(result.nextActions);
  if (result.ok && result.data.outcome === "routes") {
    if (!result.receipt) {
      throw new Error("A successful route proposal requires its authoritative receipt.");
    }
    const { compensatesOperationRef: _compensation, ...proposalReceipt } = result.receipt;
    void _compensation;
    return webMcpProposeRouteSetResultSchema.parse({
      ok: true,
      data: {
        outcome: "routes",
        routeSet: publicRouteSet(result.data.routeSet),
      },
      receipt: proposalReceipt,
      nextActions,
      stateVersion: result.stateVersion,
      guidance: result.guidance,
    });
  }
  if (result.ok) {
    return webMcpProposeRouteSetResultSchema.parse({
      ok: true,
      data: result.data,
      nextActions,
      stateVersion: result.stateVersion,
      guidance: result.guidance,
    });
  }

  const changedRefs = result.error.changedRefs?.slice(0, 20);
  const changedRefsTruncated = result.error.changedRefs !== undefined &&
    result.error.changedRefs.length > (changedRefs?.length ?? 0);
  return webMcpProposeRouteSetResultSchema.parse({
    ok: false,
    error: {
      ...result.error,
      what: result.error.what.slice(0, 500),
      ...(result.error.insteadDo
        ? { insteadDo: result.error.insteadDo.slice(0, 500) }
        : {}),
      ...(changedRefs ? { changedRefs } : {}),
      ...(changedRefsTruncated ? { changedRefsTruncated: true } : {}),
    },
    nextActions,
    stateVersion: result.stateVersion,
    guidance: result.guidance,
  });
}

function publicRouteSet(routeSet: RouteProposalSet) {
  const { availableActions, ...publicFields } = routeSet;
  const items = availableActions
    .filter((action) => action.actor === "participant")
    .map((action) => ({
      kind: pendingInteractionKind(action),
      targetRef: action.targetRef,
      guidance: action.reason ?? "A participant decision is required in the visible Route Room.",
    }));
  return {
    ...publicFields,
    pendingHumanInteractions: { items, total: items.length },
  };
}

function pendingInteractionKind(action: AvailableAction) {
  switch (action.tool) {
    case "revise_route_set":
      return "REVISE_OR_REJECT_ROUTE_SET" as const;
    case "choose_route":
      return "CHOOSE_ROUTE" as const;
    case "compensate_route_set":
      return "RESOLVE_ROUTE_SET" as const;
    default:
      throw new Error(`Unsupported participant route interaction: ${action.tool}`);
  }
}

function agentActions(actions: AvailableAction[]) {
  return actions.filter((action): action is AvailableAction & { actor: "agent" } =>
    action.actor === "agent"
  );
}

function notifyWorkspaceChanged(
  stateVersion: number,
  onWorkspaceChanged?: (stateVersion: number) => void,
  onWorkspaceSyncError?: (error: unknown, stateVersion: number) => void,
): void {
  try {
    onWorkspaceChanged?.(stateVersion);
  } catch (error) {
    try {
      onWorkspaceSyncError?.(error, stateVersion);
    } catch {
      // A projection notification must never replace an authoritative command receipt.
    }
  }
}
