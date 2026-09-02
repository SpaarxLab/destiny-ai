import type {
  AvailableAction,
  Card,
  DealerNote,
  FollowUpQuestion,
  Hypothesis,
  OperationReceipt,
  Reflection,
  Portrait,
  RouteProposalSet,
  Swipe,
  Tension,
  Workspace,
} from "./workspace";

export type RetryInstruction =
  | "NEVER"
  | "SAME_OPERATION_ID"
  | "REREAD_THEN_NEW_OPERATION"
  | "AFTER_PARTICIPANT_RESPONSE";

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
  | "STORAGE_FAILURE"
  | "TRAY_FULL"
  | "CARD_IS_A_LABEL"
  | "CLAIM_IS_A_LABEL"
  | "CARD_TOO_LONG"
  | "SELF_FALSIFICATION"
  | "TENSION_UNDER_EVIDENCED"
  | "PORTRAIT_NEEDS_TWO"
  | "TENSION_NOT_RESOLVED"
  | "NO_SWIPE_TOOL"
  | "FALSIFICATION_NEEDS_TARGET"
  | "DUEL_NEEDS_PAIR"
  | "ROUTE_UNGROUNDED"
  | "COUNTEREVIDENCE_REQUIRED";

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

export type DealCardsResult = ToolResult<{ cards: Card[]; dealRef: string }>;
export type DismissDealResult = ToolResult<{ cards: Card[] }>;
export type SwipeCardResult = ToolResult<{ swipe: Swipe; card: Card; reflection?: Reflection; tension?: Tension }>;
export type SetDeckSettingsResult = ToolResult<{ deck: Workspace["deck"] }>;
export type ProposeTensionResult = ToolResult<{ tension: Tension }>;
export type ResolveTensionResult = ToolResult<{ tension: Tension }>;
export type ProposePortraitResult = ToolResult<{ portrait: Portrait }>;
export type ResolvePortraitResult = ToolResult<{ portrait: Portrait }>;
export type PostDealerNoteResult = ToolResult<{ note: DealerNote }>;
export type DismissNoteResult = ToolResult<{ note: DealerNote }>;
export type ReopenDeckResult = ToolResult<{ portrait: Portrait }>;

export type CommandResult =
  | SaveReflectionResult
  | SetLimitsResult
  | ProposeRouteSetResult
  | ReviseRouteSetResult
  | ChooseRouteResult
  | CompensateRouteSetResult
  | SkipFollowUpResult
  | ReopenExploringResult
  | DealCardsResult
  | DismissDealResult
  | SwipeCardResult
  | SetDeckSettingsResult
  | ProposeTensionResult
  | ResolveTensionResult
  | ProposePortraitResult
  | ResolvePortraitResult
  | PostDealerNoteResult
  | DismissNoteResult
  | ReopenDeckResult;
