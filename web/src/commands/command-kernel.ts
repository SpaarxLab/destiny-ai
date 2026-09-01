import { saveReflectionCommandSchema, reflectionRequestIdentity } from "../domain/commands";
import { availableActions } from "../domain/affordances";
import type { SaveReflectionResult } from "../domain/results";
import {
  publicReceipt,
  workspaceSchema,
  type OperationRecord,
  type Reflection,
  type Workspace,
} from "../domain/workspace";
import { WorkspaceStoreError, type WorkspaceStore } from "../storage/workspace-store";

export interface CommandEnvironment {
  now(): string;
  createId(): string;
}

const defaultEnvironment: CommandEnvironment = {
  now: () => new Date().toISOString(),
  createId: () => crypto.randomUUID(),
};

export class CommandKernel {
  constructor(
    private readonly store: WorkspaceStore,
    private readonly environment: CommandEnvironment = defaultEnvironment,
  ) {}

  execute(commandInput: unknown): SaveReflectionResult {
    let workspace: Workspace;

    try {
      workspace = this.store.load();
    } catch (error) {
      return this.storageFailure(error, 0);
    }

    const parsed = saveReflectionCommandSchema.safeParse(commandInput);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "MALFORMED_INPUT",
          what: parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "command"}: ${issue.message}`)
            .join("; "),
          retry: "NEVER",
          insteadDo: "Correct the input against the save_reflection schema.",
          example: {
            name: "save_reflection",
            actor: "participant",
            input: {
              operationId: "00000000-0000-4000-8000-000000000010",
              expectedVersion: workspace.stateVersion,
              text: "I lose track of time when I simplify complex systems.",
            },
          },
        },
        nextActions: availableActions(workspace),
        stateVersion: workspace.stateVersion,
        guidance: "No state changed. Correct the command before trying again.",
      };
    }

    const command = parsed.data;
    const requestIdentity = reflectionRequestIdentity(command);
    const existing = workspace.operations.find(
      (operation) => operation.operationId === command.input.operationId,
    );

    if (existing) {
      if (existing.requestIdentity !== requestIdentity) {
        return {
          ok: false,
          error: {
            code: "OPERATION_CONFLICT",
            what: "This operationId already belongs to a different command intent.",
            retry: "NEVER",
            insteadDo: "Use a new operationId for the new intended effect.",
            changedRefs: existing.changedRefs,
          },
          nextActions: availableActions(workspace),
          stateVersion: workspace.stateVersion,
          guidance: "The existing operation was preserved and no state changed.",
        };
      }

      const reflection = reflectionFromReceipt(workspace, existing);
      if (!reflection) {
        return this.storageFailure(
          new WorkspaceStoreError(
            "CORRUPT_WORKSPACE",
            "The replay receipt no longer points to its reflection.",
            workspace.stateVersion,
          ),
          workspace.stateVersion,
        );
      }

      return {
        ok: true,
        data: { reflection },
        receipt: publicReceipt(existing),
        nextActions: availableActions(workspace),
        stateVersion: workspace.stateVersion,
        guidance: "Replay detected. The original receipt was returned without a new effect.",
      };
    }

    if (command.input.expectedVersion !== workspace.stateVersion) {
      return staleResult(workspace, command.input.expectedVersion);
    }

    if (workspace.phase !== "EXPLORING") {
      return {
        ok: false,
        error: {
          code: "WRONG_PHASE",
          what: `save_reflection is unavailable in ${workspace.phase}.`,
          retry: "NEVER",
          insteadDo: "Use an action declared for the current phase.",
        },
        nextActions: availableActions(workspace),
        stateVersion: workspace.stateVersion,
        guidance: "No state changed because the live phase denied this command.",
      };
    }

    const afterVersion = workspace.stateVersion + 1;
    const at = this.environment.now();
    const reflection: Reflection = {
      id: this.environment.createId(),
      ref: `reflection-${afterVersion}`,
      availableActions: [],
      status: command.actor === "participant" ? "confirmed" : "proposed",
      text: command.input.text,
      recordedBy: command.actor === "participant" ? "participant" : "agent_transcribed",
      createdAt: at,
    };
    const operation: OperationRecord = {
      operationId: command.input.operationId,
      operationRef: `operation-${afterVersion}`,
      actor: command.actor,
      command: command.name,
      effect: command.actor === "participant" ? "APPLIED" : "PROPOSED",
      beforeVersion: workspace.stateVersion,
      afterVersion,
      changedRefs: [reflection.ref],
      at,
      requestIdentity,
    };
    const nextWorkspace = workspaceSchema.parse({
      ...workspace,
      stateVersion: afterVersion,
      reflections: [...workspace.reflections, reflection],
      operations: [...workspace.operations, operation],
    });

    try {
      this.store.save(workspace.stateVersion, nextWorkspace);
    } catch (error) {
      if (error instanceof WorkspaceStoreError && error.code === "STALE_WRITE") {
        let current = workspace;
        try {
          current = this.store.load();
        } catch {
          // The original workspace still provides a safe typed response.
        }
        return staleResult(current, command.input.expectedVersion);
      }

      return this.storageFailure(error, workspace.stateVersion);
    }

    return {
      ok: true,
      data: { reflection },
      receipt: publicReceipt(operation),
      nextActions: availableActions(nextWorkspace),
      stateVersion: nextWorkspace.stateVersion,
      guidance:
        command.actor === "participant"
          ? "The participant reflection is confirmed and visible in the workspace."
          : "The agent transcription is a visible proposal awaiting participant review.",
    };
  }

  private storageFailure(error: unknown, stateVersion: number): SaveReflectionResult {
    const what =
      error instanceof Error ? error.message : "The workspace could not be read or written.";

    return {
      ok: false,
      error: {
        code: "STORAGE_FAILURE",
        what,
        retry: "SAME_OPERATION_ID",
        insteadDo: "Preserve the current data and retry only after storage is available.",
      },
      nextActions: [],
      stateVersion,
      guidance: "Storage did not confirm a new authoritative state.",
    };
  }
}

function reflectionFromReceipt(
  workspace: Workspace,
  operation: OperationRecord,
): Reflection | undefined {
  const changedRef = operation.changedRefs[0];
  return workspace.reflections.find((reflection) => reflection.ref === changedRef);
}

function staleResult(workspace: Workspace, expectedVersion: number): SaveReflectionResult {
  const changedRefs = Array.from(
    new Set(
      workspace.operations
        .filter((operation) => operation.afterVersion > expectedVersion)
        .flatMap((operation) => operation.changedRefs),
    ),
  );

  return {
    ok: false,
    error: {
      code: "STALE_STATE",
      what: `Expected workspace version ${expectedVersion}, but current version is ${workspace.stateVersion}.`,
      retry: "REREAD_THEN_NEW_OPERATION",
      insteadDo: "Reread the workspace, reconsider the new state, then use a new operationId.",
      changedRefs,
    },
    nextActions: availableActions(workspace),
    stateVersion: workspace.stateVersion,
    guidance: "No state changed because this command was based on stale state.",
  };
}
