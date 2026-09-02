import { z } from "zod";
import {
  CONTRACT_VERSION,
  WORKSPACE_SCHEMA_VERSION,
  actorSchema,
  operationRecordSchema,
  participantSchema,
  phaseSchema,
  workspaceObjectSchema,
  workspaceSchema,
  type OperationRecord,
  type Workspace,
} from "../domain/workspace";
import { WorkspaceStoreError, type WorkspaceStore } from "./workspace-store";

export const LOCAL_WORKSPACE_KEY = "destiny-ai.workspace.v1";

export interface WorkspaceLockManager {
  request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T>;
}

export class LocalWorkspaceStore implements WorkspaceStore {
  constructor(
    private readonly storage: Storage,
    private readonly initialWorkspace: Workspace,
    private readonly locks: WorkspaceLockManager,
    private readonly key = LOCAL_WORKSPACE_KEY,
  ) {}

  load(): Workspace {
    const raw = this.storage.getItem(this.key);

    if (raw === null) {
      return workspaceSchema.parse(this.initialWorkspace);
    }

    try {
      return migrateWorkspace(JSON.parse(raw));
    } catch {
      throw new WorkspaceStoreError(
        "CORRUPT_WORKSPACE",
        "The saved workspace is invalid. Its original bytes were preserved.",
      );
    }
  }

  async save(expectedVersion: number, nextWorkspace: Workspace): Promise<void> {
    await this.locks.request(`${this.key}.write`, async () => {
      const current = this.load();
      if (current.stateVersion !== expectedVersion) {
        throw new WorkspaceStoreError(
          "STALE_WRITE",
          "The workspace changed before the command could be saved.",
          current.stateVersion,
        );
      }

      this.persist(workspaceSchema.parse(nextWorkspace));
    });
  }

  async clear(expectedVersion: number): Promise<void> {
    await this.locks.request(`${this.key}.write`, async () => {
      const current = this.load();
      if (current.stateVersion !== expectedVersion) {
        throw new WorkspaceStoreError(
          "STALE_WRITE",
          "The workspace changed before it could be cleared.",
          current.stateVersion,
        );
      }

      try {
        this.storage.removeItem(this.key);
      } catch {
        throw new WorkspaceStoreError(
          "PERSISTENCE_FAILED",
          "The browser could not clear the workspace.",
          current.stateVersion,
        );
      }
    });
  }

  private persist(workspace: Workspace): void {
    try {
      this.storage.setItem(this.key, JSON.stringify(workspace));
    } catch {
      throw new WorkspaceStoreError(
        "PERSISTENCE_FAILED",
        "The browser could not persist the workspace.",
        workspace.stateVersion,
      );
    }
  }
}

// Schema v1 (P1/P2): reflections only, no actor on available actions.
const legacyAvailableActionSchema = z.strictObject({
  tool: z.string().min(1).max(64),
  targetRef: z.string().min(1).max(128),
  effect: z.enum(["READ", "PREPARE_UI", "PROPOSE"]),
  requiresHuman: z.boolean(),
  reason: z.string().min(1).max(240).optional(),
});

const legacyReflectionSchema = z.strictObject({
  id: z.string().uuid(),
  ref: z.string().min(1).max(128),
  availableActions: z.array(legacyAvailableActionSchema),
  status: z.enum(["proposed", "confirmed"]),
  text: z.string().min(1).max(2_000),
  recordedBy: z.enum(["participant", "agent_transcribed"]),
  createdAt: z.string().datetime({ offset: true }),
});

const emptyLegacyCollection = z.array(z.never()).length(0);
const legacyV1WorkspaceSchema = z.strictObject({
  id: z.string().uuid(),
  schemaVersion: z.literal(1),
  contractVersion: z.literal("1.0.0"),
  stateVersion: z.number().int().nonnegative(),
  phase: phaseSchema,
  participant: participantSchema,
  reflections: z.array(legacyReflectionSchema),
  hypotheses: emptyLegacyCollection,
  experiments: emptyLegacyCollection,
  evidence: emptyLegacyCollection,
  revisions: emptyLegacyCollection,
  planItems: emptyLegacyCollection,
  outbox: emptyLegacyCollection,
  teachings: emptyLegacyCollection,
  operations: z.array(operationRecordSchema),
});

// Schema v2 (P3A): route sets and hypotheses, no follow-up questions.
const deckFields = {
  cards: true,
  swipes: true,
  tensions: true,
  portraits: true,
  dealerNotes: true,
  deck: true,
} as const;

const legacyV3WorkspaceSchema = workspaceObjectSchema
  .omit(deckFields)
  .extend({ schemaVersion: z.literal(3), contractVersion: z.literal("1.2.0") });

const legacyV2WorkspaceSchema = workspaceObjectSchema
  .omit({ ...deckFields, followUpQuestions: true })
  .extend({
    schemaVersion: z.literal(2),
    contractVersion: z.literal("1.1.0"),
  });

export function migrateWorkspace(input: unknown): Workspace {
  const current = workspaceSchema.safeParse(input);
  if (current.success) return current.data;

  const legacyInput = stripDeckFields(input);
  const v3 = legacyV3WorkspaceSchema.safeParse(legacyInput);
  if (v3.success) return migrateV3(v3.data);

  const v2 = legacyV2WorkspaceSchema.safeParse(legacyInput);
  if (v2.success) return migrateV2(v2.data);

  const v1 = legacyV1WorkspaceSchema.parse(legacyInput);
  return migrateV2(legacyV2WorkspaceSchema.parse({
    ...v1,
    schemaVersion: 2,
    contractVersion: "1.1.0",
    reflections: v1.reflections.map((reflection) => ({
      ...reflection,
      availableActions: reflection.availableActions.map((action) => ({
        ...action,
        actor: actorSchema.parse("agent"),
      })),
    })),
    operations: v1.operations.map(normalizeLegacyOperation),
    routeProposalSets: [],
    hypotheses: [],
  }));
}

function stripDeckFields(input: unknown): unknown {
  if (typeof input !== "object" || input === null || !("schemaVersion" in input) || ![1, 2, 3].includes(Number(input.schemaVersion))) return input;
  const { cards, swipes, tensions, portraits, dealerNotes, deck, ...legacy } = input as Record<string, unknown>;
  void cards; void swipes; void tensions; void portraits; void dealerNotes; void deck;
  return legacy;
}

function migrateV2(legacy: z.infer<typeof legacyV2WorkspaceSchema>): Workspace {
  return migrateV3(legacyV3WorkspaceSchema.parse({
    ...legacy,
    schemaVersion: 3,
    contractVersion: "1.2.0",
    followUpQuestions: [],
  }));
}

function migrateV3(legacy: z.infer<typeof legacyV3WorkspaceSchema>): Workspace {
  return workspaceSchema.parse({
    ...legacy,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    contractVersion: CONTRACT_VERSION,
    cards: [],
    swipes: [],
    tensions: [],
    portraits: [],
    dealerNotes: [],
    deck: { dwellTracking: true, consentEmbedded: false, dealsUnresolved: 0 },
  });
}

function normalizeLegacyOperation(operation: OperationRecord): OperationRecord {
  if (operation.command !== "save_reflection") {
    throw new Error(`Unsupported schema-v1 command ${operation.command}.`);
  }
  const identity: unknown = JSON.parse(operation.requestIdentity);
  if (
    typeof identity !== "object" || identity === null ||
    Object.keys(identity).sort().join(",") !== "actor,name,text" ||
    !("name" in identity) || identity.name !== "save_reflection" ||
    !("actor" in identity) || identity.actor !== operation.actor ||
    !("text" in identity) || typeof identity.text !== "string"
  ) {
    throw new Error("Invalid schema-v1 save_reflection request identity.");
  }
  return {
    ...operation,
    requestIdentity: JSON.stringify({
      name: "save_reflection",
      actor: operation.actor,
      input: { text: identity.text },
    }),
  };
}
