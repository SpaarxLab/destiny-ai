import type { ProposeRouteSetInput } from "../../domain/commands";
import type { ProposeRouteSetResult } from "../../domain/results";
import type { AvailableAction, FollowUpQuestion, RouteProposalSet } from "../../domain/workspace";
import type { WebMcpCommandAdapter } from "../../adapters/webmcp-command-adapter";
import type { WorkspaceReader } from "../../projections/workspace-reader";
import { denialSummary, emitActivity, STALE_REGISTRATION_SUMMARY, type AgentActivityListener } from "../activity";
import {
  staleRegistrationResult,
  webMcpProposeRouteSetResultSchema,
  type WebMcpProposeRouteSetResult,
} from "../contracts";
import type { WebMcpToolDefinition } from "../runtime";
import { PROPOSE_ROUTE_SET_INPUT_SCHEMA } from "../catalogue/propose-route-set-schema";

export const PROPOSE_ROUTE_SET_DESCRIPTION =
  "Propose exactly three grounded Destiny.AI route previews (one closest, one bridge, one probe) from the participant's confirmed words, or ask one focused follow-up question with outcome insufficient_signal. Rules the room enforces: every sourceQuotes[].quote must be an exact substring of a confirmedWords[].text from read_workspace and cite its ref; every test must stay within focus.costCaps (hours, money, same currency) and 1-7 days; the three routes need distinct learningQuestion and distinct test values; use fresh route refs that do not exist in the workspace; when read_workspace.proposal.supersedesRouteSetRef is not null cite it as supersedesRouteSetRef; when proposal.mode is replace_rejected send { carryRouteRef } for every kept route in carryRouteRefs and a fresh route only for each kind in replaceKinds. Returns the authoritative typed result with a receipt when state changes. The participant alone may edit, set aside, choose, answer, or skip.";

export function canRegisterProposeRouteSet(reader: WorkspaceReader): boolean {
  const orientation = reader.read({ view: "orientation" });
  return orientation.ok && orientation.nextActions.some((action) =>
    action.actor === "agent" && action.tool === "propose_route_set"
  );
}

/**
 * A proposal that ChatGPT already made stays reachable for exact same-operation replay while it
 * is unresolved, so a lost response can be recovered after any refresh. Replay eligibility is
 * derived from the ledger-backed projection, never from in-memory state; the kernel decides
 * replay versus conflict versus lifecycle denial.
 */
export function canRegisterProposeRouteSetReplay(reader: WorkspaceReader): boolean {
  const orientation = reader.read({ view: "orientation" });
  if (!orientation.ok || orientation.data?.view !== "orientation") return false;
  if (orientation.data.identity.phase !== "EXPLORING") return false;
  const routeSet = orientation.data.active.routeSet;
  if (routeSet?.status === "proposed" && routeSet.createdBy === "chatgpt_webmcp") return true;
  const followUp = orientation.data.active.followUp;
  return followUp?.status === "proposed" && followUp.askedBy === "chatgpt_webmcp";
}

export function createProposeRouteSetTool(
  adapter: WebMcpCommandAdapter,
  reader: WorkspaceReader,
  signal: AbortSignal,
  options: Readonly<{
    replayOnly?: boolean;
    onProposalCommitted?: (operationId: string) => void;
    onWorkspaceChanged?: (stateVersion: number) => void;
    onWorkspaceSyncError?: (error: unknown, stateVersion: number) => void;
    onAgentActivity?: AgentActivityListener;
  }> = {},
): WebMcpToolDefinition {
  void reader;
  return {
    name: "propose_route_set",
    description: PROPOSE_ROUTE_SET_DESCRIPTION,
    inputSchema: PROPOSE_ROUTE_SET_INPUT_SCHEMA,
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    async execute(input: unknown) {
      if (signal.aborted) {
        emitActivity(options.onAgentActivity, {
          tool: "propose_route_set",
          outcome: "stale_registration",
          effect: "NONE",
          summary: STALE_REGISTRATION_SUMMARY,
          code: "STALE_REGISTRATION",
          stateVersion: 0,
        });
        return webMcpProposeRouteSetResultSchema.parse(staleRegistrationResult());
      }
      const result = await adapter.proposeRouteSet(input as ProposeRouteSetInput);
      const publicResult = serializeProposeRouteSetResult(result);
      const replayed = publicResult.ok && publicResult.guidance.startsWith("Replay detected");
      if (publicResult.ok) {
        const data = publicResult.data;
        const summary = replayed
          ? "ChatGPT recovered its earlier receipt; nothing new was written."
          : data.outcome === "routes"
            ? data.routeSet.routes.some((route) => route.carriedFromRouteRef !== undefined)
              ? "ChatGPT replaced the route you set aside and kept the rest unchanged."
              : "ChatGPT proposed three routes for you to review."
            : "ChatGPT asked one question before proposing.";
        emitActivity(options.onAgentActivity, {
          tool: "propose_route_set",
          outcome: "ok",
          effect: replayed ? "REPLAY" : "PROPOSED",
          summary,
          stateVersion: publicResult.stateVersion,
          changedRefs: publicResult.receipt.changedRefs,
        });
        if (!replayed) {
          options.onProposalCommitted?.(publicResult.receipt.operationId);
          notifyWorkspaceChanged(
            publicResult.stateVersion,
            options.onWorkspaceChanged,
            options.onWorkspaceSyncError,
          );
        }
      } else {
        emitActivity(options.onAgentActivity, {
          tool: "propose_route_set",
          outcome: "denied",
          effect: "NONE",
          summary: denialSummary(publicResult.error),
          code: publicResult.error.code,
          stateVersion: publicResult.stateVersion,
          changedRefs: publicResult.error.changedRefs,
        });
      }
      return publicResult;
    },
  };
}

export function serializeProposeRouteSetResult(
  result: ProposeRouteSetResult,
): WebMcpProposeRouteSetResult {
  const nextActions = agentActions(result.nextActions);
  if (result.ok) {
    if (!result.receipt) {
      throw new Error("A successful proposal requires its authoritative receipt.");
    }
    const { compensatesOperationRef: _compensation, ...proposalReceipt } = result.receipt;
    void _compensation;
    if (result.data.outcome === "routes") {
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
    return webMcpProposeRouteSetResultSchema.parse({
      ok: true,
      data: {
        outcome: "insufficient_signal",
        followUp: publicFollowUp(result.data.followUp),
      },
      receipt: proposalReceipt,
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

function publicFollowUp(followUp: FollowUpQuestion) {
  const { availableActions, ...publicFields } = followUp;
  const items = availableActions
    .filter((action) => action.actor === "participant")
    .map((action) => ({
      kind: action.tool === "skip_follow_up" ? "SKIP_FOLLOW_UP" as const : "ANSWER_FOLLOW_UP" as const,
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
