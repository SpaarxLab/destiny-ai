import type {
  AvailableAction,
  Hypothesis,
  OperationReceipt,
  Reflection,
  RouteProposalSet,
} from "./workspace";

export type RetryInstruction =
  | "NEVER"
  | "SAME_OPERATION_ID"
  | "REREAD_THEN_NEW_OPERATION";

export type CommandErrorCode =
  | "MALFORMED_INPUT"
  | "INSUFFICIENT_SIGNAL"
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

export type SaveReflectionResult = ToolResult<{ reflection: Reflection }>;

export type ProposeRouteSetResult = ToolResult<{
  routeSet?: RouteProposalSet;
  outcome: "routes" | "insufficient_signal";
  followUpQuestion?: string;
  reasonRefs?: string[];
}>;

export type ReviseRouteSetResult = ToolResult<{ routeSet: RouteProposalSet }>;

export type ChooseRouteResult = ToolResult<{
  routeSet: RouteProposalSet;
  hypothesis: Hypothesis;
}>;

export type CompensateRouteSetResult = ToolResult<{ routeSet: RouteProposalSet }>;

export type CommandResult =
  | SaveReflectionResult
  | ProposeRouteSetResult
  | ReviseRouteSetResult
  | ChooseRouteResult
  | CompensateRouteSetResult;
