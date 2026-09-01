import type {
  AvailableAction,
  FollowUpQuestion,
  Hypothesis,
  OperationReceipt,
  Reflection,
  RouteProposalSet,
  Workspace,
} from "./workspace";

export type RetryInstruction =
  | "NEVER"
  | "SAME_OPERATION_ID"
  | "REREAD_THEN_NEW_OPERATION";

export type CommandErrorCode =
  | "MALFORMED_INPUT"
  | "WRONG_ACTOR"
  | "WRONG_PHASE"
  | "WRONG_LIFECYCLE"
  | "UNKNOWN_REF"
  | "POLICY_DENIED"
  | "STALE_STATE"
  | "OPERATION_CONFLICT"
  | "INVALID_CURSOR"
  | "STORAGE_FAILURE";

export interface CommandError {
  code: CommandErrorCode;
  what: string;
  retry: RetryInstruction;
  insteadDo?: string;
  example?: unknown;
  changedRefs?: string[];
}

export interface ToolResult<T> {
  ok: boolean;
  data?: T;
  receipt?: OperationReceipt;
  error?: CommandError;
  nextActions: AvailableAction[];
  stateVersion: number;
  guidance: string;
}

export type SaveReflectionResult = ToolResult<{
  reflection: Reflection;
  answeredFollowUp?: FollowUpQuestion;
}>;

export type SetLimitsResult = ToolResult<{ participant: Workspace["participant"] }>;

export type ProposeRouteSetResult =
  | (ToolResult<{ outcome: "routes"; routeSet: RouteProposalSet }> & {
      ok: true;
      data: { outcome: "routes"; routeSet: RouteProposalSet };
      receipt: OperationReceipt;
      error?: never;
    })
  | (ToolResult<{
      outcome: "insufficient_signal";
      followUp: FollowUpQuestion;
    }> & {
      ok: true;
      data: {
        outcome: "insufficient_signal";
        followUp: FollowUpQuestion;
      };
      receipt: OperationReceipt;
      error?: never;
    })
  | (ToolResult<never> & {
      ok: false;
      data?: never;
      receipt?: never;
      error: CommandError;
    });

export type ReviseRouteSetResult = ToolResult<{ routeSet: RouteProposalSet }>;

export type ChooseRouteResult = ToolResult<{
  routeSet: RouteProposalSet;
  hypothesis: Hypothesis;
}>;

export type CompensateRouteSetResult = ToolResult<{ routeSet: RouteProposalSet }>;

export type SkipFollowUpResult = ToolResult<{ followUp: FollowUpQuestion }>;

export type ReopenExploringResult = ToolResult<{ hypothesis: Hypothesis }>;

export type CommandResult =
  | SaveReflectionResult
  | SetLimitsResult
  | ProposeRouteSetResult
  | ReviseRouteSetResult
  | ChooseRouteResult
  | CompensateRouteSetResult
  | SkipFollowUpResult
  | ReopenExploringResult;
