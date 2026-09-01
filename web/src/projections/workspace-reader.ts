import { availableActions } from "../domain/affordances";
import {
  ORIENTATION_ESTIMATED_TOKEN_BUDGET,
  ORIENTATION_MAX_SERIALIZED_CHARS,
  READ_CHANGE_LIMIT,
  READ_ENTITY_LIMIT,
  entitiesProjectionSchema,
  orientationProjectionSchema,
  readWorkspaceInputSchema,
  workingSetProjectionSchema,
  type ChangeSummary,
  type OrientationProjection,
  type ReadWorkspaceResult,
  type WorkspaceIdentity,
} from "../domain/reads";
import type { OperationRecord, Workspace } from "../domain/workspace";
import type { WorkspaceStore } from "../storage/workspace-store";

const PENDING_INTERACTION_LIMIT = 10;

export class WorkspaceReader {
  constructor(private readonly store: WorkspaceStore) {}

  read(input: unknown = {}): ReadWorkspaceResult {
    let workspace: Workspace;

    try {
      workspace = this.store.load();
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "STORAGE_FAILURE",
          what: error instanceof Error ? error.message : "The workspace could not be read.",
          retry: "NEVER",
          insteadDo: "Restore readable workspace storage before requesting orientation.",
        },
        nextActions: [],
        stateVersion: 0,
        guidance: "No orientation was produced because current truth could not be read.",
      };
    }

    const parsed = readWorkspaceInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "MALFORMED_INPUT",
          what: parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
            .join("; "),
          retry: "NEVER",
          insteadDo: "Use orientation, working_set, or a bounded list of entity refs.",
          example: { view: "orientation", sinceCursor: cursorFor(workspace) },
        },
        nextActions: availableActions(workspace),
        stateVersion: workspace.stateVersion,
        guidance: "No state changed. Correct the read request before trying again.",
      };
    }

    const request = parsed.data;
    if (request.view === "entities") {
      const requestedRefs = Array.from(new Set(request.refs));
      const byRef = new Map(workspace.reflections.map((reflection) => [reflection.ref, reflection]));
      const entities = requestedRefs.flatMap((ref) => {
        const entity = byRef.get(ref);
        return entity ? [entity] : [];
      });

      return {
        ok: true,
        data: entitiesProjectionSchema.parse({
          view: "entities",
          identity: identityFor(workspace),
          entities,
          missingRefs: requestedRefs.filter((ref) => !byRef.has(ref)),
          availableActions: availableActions(workspace),
          guidance: "Only the requested known entities are returned; missing refs are explicit.",
        }),
        nextActions: availableActions(workspace),
        stateVersion: workspace.stateVersion,
        guidance: "Targeted entity read completed without changing state.",
      };
    }

    const changeResult = changesSince(workspace, request.sinceCursor);
    if (!changeResult.ok) {
      return {
        ok: false,
        error: {
          code: "INVALID_CURSOR",
          what: changeResult.what,
          retry: "NEVER",
          insteadDo: "Discard this cursor and perform a cold orientation read.",
        },
        nextActions: availableActions(workspace),
        stateVersion: workspace.stateVersion,
        guidance: "No state changed. The cursor did not identify history for this workspace.",
      };
    }

    const cursor = changeResult.cursor;
    if (request.view === "working_set") {
      const truncated = workspace.reflections.length > READ_ENTITY_LIMIT;
      return {
        ok: true,
        data: workingSetProjectionSchema.parse({
          view: "working_set",
          identity: identityFor(workspace),
          reflections: workspace.reflections.slice(-READ_ENTITY_LIMIT),
          truncated,
          changes: changeResult.changes,
          cursor,
          availableActions: availableActions(workspace),
          guidance: truncated
            ? "The active reflection set is bounded; use targeted entity reads for omitted refs."
            : "The current active reflection set is complete.",
        }),
        nextActions: availableActions(workspace),
        stateVersion: workspace.stateVersion,
        guidance: "Working-set read completed without changing state.",
      };
    }

    const data = orientationFor(workspace, cursor, changeResult.changes);
    const result: ReadWorkspaceResult = {
      ok: true,
      data,
      nextActions: data.availableActions,
      stateVersion: workspace.stateVersion,
      guidance: "Cold orientation completed without changing state.",
    };
    boundOrientationResult(result);
    return result;
  }
}

function orientationFor(
  workspace: Workspace,
  cursor: string,
  changes: OrientationProjection["changes"],
): OrientationProjection {
  const proposed = workspace.reflections.filter((reflection) => reflection.status === "proposed");
  const confirmedCount = workspace.reflections.length - proposed.length;
  const pendingItems = proposed.slice(0, PENDING_INTERACTION_LIMIT).map((reflection) => ({
    ref: reflection.ref,
    kind: "CONFIRM_REFLECTION" as const,
    excerpt: excerpt(reflection.text),
  }));
  const nextHumanDecision: OrientationProjection["nextHumanDecision"] = proposed.length
    ? {
        kind: "REVIEW_PROPOSED_REFLECTION",
        targetRefs: [proposed[0].ref],
        guidance: "Confirm, edit, or reject the visible agent transcription before relying on it.",
      }
    : {
        kind: "ADD_REFLECTION",
        targetRefs: [workspace.id],
        guidance: "Add a participant reflection or prepare a transcription for human review.",
      };
  const constraints = [
    `Time cap: ${workspace.participant.costCaps.hoursPerWeek} hours/week`,
    `Money cap: ${workspace.participant.costCaps.money} ${workspace.participant.costCaps.currency}`,
  ];

  const projection: OrientationProjection = {
    view: "orientation",
    identity: identityFor(workspace),
    focus: {
      question: workspace.participant.focusQuestion || null,
      costCaps: workspace.participant.costCaps,
    },
    active: { hypothesis: null, experiment: null },
    nextHumanDecision,
    constraints,
    teachings: [],
    pendingHumanInteractions: {
      items: pendingItems,
      total: proposed.length,
      truncated: proposed.length > pendingItems.length,
    },
    conflicts: [],
    changes: {
      ...changes,
      items: [...changes.items],
    },
    cursor,
    availableActions: availableActions(workspace),
    proof: {
      level:
        confirmedCount > 0
          ? "PARTICIPANT_CONFIRMED"
          : proposed.length > 0
            ? "PROPOSED"
            : "NONE",
      confirmedReflectionCount: confirmedCount,
      proposedReflectionCount: proposed.length,
    },
    guidance:
      "Use target refs and declared actions only. Proposed content requires human confirmation.",
  };

  return orientationProjectionSchema.parse(projection);
}

function changesSince(
  workspace: Workspace,
  suppliedCursor?: string,
):
  | { ok: true; changes: OrientationProjection["changes"]; cursor: string }
  | { ok: false; what: string } {
  if (suppliedCursor === undefined) {
    return {
      ok: true,
      changes: { sinceCursor: null, items: [], truncated: false },
      cursor: cursorFor(workspace),
    };
  }

  const match = /^workspace:([0-9a-f-]{36}):v(\d+)$/i.exec(suppliedCursor);
  if (!match || match[1] !== workspace.id) {
    return { ok: false, what: "The cursor is malformed or belongs to another workspace." };
  }

  const version = Number(match[2]);
  if (!Number.isSafeInteger(version) || version < 0 || version > workspace.stateVersion) {
    return { ok: false, what: "The cursor version is outside this workspace's known history." };
  }

  const matching = workspace.operations.filter((operation) => operation.afterVersion > version);
  const page = matching.slice(0, READ_CHANGE_LIMIT);
  return {
    ok: true,
    changes: {
      sinceCursor: suppliedCursor,
      items: page.map(publicChange),
      truncated: matching.length > READ_CHANGE_LIMIT,
    },
    cursor: cursorForVersion(
      workspace,
      matching.length > READ_CHANGE_LIMIT
        ? page.at(-1)?.afterVersion ?? version
        : workspace.stateVersion,
    ),
  };
}

function publicChange(operation: OperationRecord): ChangeSummary {
  return {
    operationRef: operation.operationRef,
    command: operation.command,
    effect: operation.effect,
    afterVersion: operation.afterVersion,
    changedRefs: operation.changedRefs.slice(0, READ_ENTITY_LIMIT),
    changedRefsTruncated: operation.changedRefs.length > READ_ENTITY_LIMIT,
    at: operation.at,
  };
}

function cursorFor(workspace: Workspace): string {
  return cursorForVersion(workspace, workspace.stateVersion);
}

function cursorForVersion(workspace: Workspace, version: number): string {
  return `workspace:${workspace.id}:v${version}`;
}

function identityFor(workspace: Workspace): WorkspaceIdentity {
  return {
    workspaceRef: workspace.id,
    schemaVersion: workspace.schemaVersion,
    contractVersion: workspace.contractVersion,
    stateVersion: workspace.stateVersion,
    phase: workspace.phase,
  };
}

function excerpt(text: string): string {
  return text.length <= 160 ? text : `${text.slice(0, 157)}...`;
}

function boundOrientationResult(result: ReadWorkspaceResult): void {
  if (!result.ok || result.data?.view !== "orientation") {
    return;
  }

  const projection = result.data;
  while (overOrientationBudget(result) && projection.pendingHumanInteractions.items.length) {
    projection.pendingHumanInteractions.items.pop();
    projection.pendingHumanInteractions.truncated = true;
  }
  while (overOrientationBudget(result) && projection.changes.items.length) {
    projection.changes.items.pop();
    projection.changes.truncated = true;
    const lastDeliveredVersion = projection.changes.items.at(-1)?.afterVersion;
    projection.cursor =
      lastDeliveredVersion === undefined
        ? projection.changes.sinceCursor ?? projection.cursor
        : `workspace:${projection.identity.workspaceRef}:v${lastDeliveredVersion}`;
  }

  orientationProjectionSchema.parse(projection);
}

function overOrientationBudget(result: ReadWorkspaceResult): boolean {
  const serialized = JSON.stringify(result);
  return (
    serialized.length > ORIENTATION_MAX_SERIALIZED_CHARS ||
    new TextEncoder().encode(serialized).length > ORIENTATION_ESTIMATED_TOKEN_BUDGET
  );
}
