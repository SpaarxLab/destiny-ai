import type {
  AvailableAction,
  OperationReceipt,
  Reflection,
} from "./workspace";

export type RetryInstruction =
  | "NEVER"
  | "SAME_OPERATION_ID"
  | "REREAD_THEN_NEW_OPERATION";

export type CommandErrorCode =
  | "MALFORMED_INPUT"
  | "WRONG_PHASE"
  | "STALE_STATE"
  | "OPERATION_CONFLICT"
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
