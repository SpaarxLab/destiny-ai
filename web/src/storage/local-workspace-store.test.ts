import { describe, expect, it } from "vitest";
import { createParticipantCommandAdapter } from "../adapters/participant-command-adapter";
import { CommandKernel } from "../commands/command-kernel";
import { p3Workspace, validRoutes } from "../commands/fixtures/p3-route-set";
import { CONTRACT_VERSION, WORKSPACE_SCHEMA_VERSION, createEmptyWorkspace } from "../domain/workspace";
import {
  LOCAL_WORKSPACE_KEY,
  LocalWorkspaceStore,
  type WorkspaceLockManager,
} from "./local-workspace-store";

const operationOne = "00000000-0000-4000-8000-000000000010";
const operationTwo = "00000000-0000-4000-8000-000000000020";

describe("LocalWorkspaceStore", () => {
  it("does not persist an empty workspace during a read", () => {
    const storage = new MemoryStorage();
    const store = new LocalWorkspaceStore(
      storage,
      createEmptyWorkspace(),
      new SerialLockManager(),
    );

    expect(store.load()).toEqual(createEmptyWorkspace());
    expect(storage.getItem(LOCAL_WORKSPACE_KEY)).toBeNull();
  });

  it("serializes competing tab writes so one succeeds and one returns stale state", async () => {
    const storage = new MemoryStorage();
    const locks = new SerialLockManager();
    const firstStore = new LocalWorkspaceStore(storage, createEmptyWorkspace(), locks);
    const secondStore = new LocalWorkspaceStore(storage, createEmptyWorkspace(), locks);
    const first = createParticipantCommandAdapter(new CommandKernel(firstStore));
    const second = createParticipantCommandAdapter(new CommandKernel(secondStore));

    const [firstResult, secondResult] = await Promise.all([
      first.saveReflection({
        operationId: operationOne,
        expectedVersion: 0,
        text: "Write from tab one.",
      }),
      second.saveReflection({
        operationId: operationTwo,
        expectedVersion: 0,
        text: "Write from tab two.",
      }),
    ]);

    expect([firstResult.ok, secondResult.ok].sort()).toEqual([false, true]);
    const stale = firstResult.ok ? secondResult : firstResult;
    expect(stale.error).toMatchObject({
      code: "STALE_STATE",
      retry: "REREAD_THEN_NEW_OPERATION",
    });

    const workspace = firstStore.load();
    expect(workspace.stateVersion).toBe(1);
    expect(workspace.reflections).toHaveLength(1);
    expect(workspace.operations).toHaveLength(1);
  });

  it("returns the original receipt when two tabs concurrently retry one operation", async () => {
    const storage = new MemoryStorage();
    const locks = new SerialLockManager();
    const firstStore = new LocalWorkspaceStore(storage, createEmptyWorkspace(), locks);
    const secondStore = new LocalWorkspaceStore(storage, createEmptyWorkspace(), locks);
    const input = {
      operationId: operationOne,
      expectedVersion: 0,
      text: "One retry-safe write from two tabs.",
    };

    const [firstResult, secondResult] = await Promise.all([
      createParticipantCommandAdapter(new CommandKernel(firstStore)).saveReflection(input),
      createParticipantCommandAdapter(new CommandKernel(secondStore)).saveReflection(input),
    ]);

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    expect(secondResult.receipt).toEqual(firstResult.receipt);
    expect([firstResult.guidance, secondResult.guidance]).toContain(
      "Replay detected. The original receipt was returned without a new effect.",
    );
    expect(firstStore.load().reflections).toHaveLength(1);
    expect(firstStore.load().operations).toHaveLength(1);
  });

  it("returns an operation conflict when two tabs reuse one id for different intent", async () => {
    const storage = new MemoryStorage();
    const locks = new SerialLockManager();
    const firstStore = new LocalWorkspaceStore(storage, createEmptyWorkspace(), locks);
    const secondStore = new LocalWorkspaceStore(storage, createEmptyWorkspace(), locks);

    const results = await Promise.all([
      createParticipantCommandAdapter(new CommandKernel(firstStore)).saveReflection({
        operationId: operationOne,
        expectedVersion: 0,
        text: "Intent from tab one.",
      }),
      createParticipantCommandAdapter(new CommandKernel(secondStore)).saveReflection({
        operationId: operationOne,
        expectedVersion: 0,
        text: "Different intent from tab two.",
      }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)?.error).toMatchObject({
      code: "OPERATION_CONFLICT",
      retry: "NEVER",
    });
    expect(firstStore.load().reflections).toHaveLength(1);
    expect(firstStore.load().operations).toHaveLength(1);
  });

  it("preserves corrupt bytes and returns a typed storage failure", async () => {
    const storage = new MemoryStorage();
    const corruptBytes = "{not-json";
    storage.setItem(LOCAL_WORKSPACE_KEY, corruptBytes);
    const store = new LocalWorkspaceStore(
      storage,
      createEmptyWorkspace(),
      new SerialLockManager(),
    );

    expect(() => store.load()).toThrowError(/original bytes were preserved/i);
    const result = await createParticipantCommandAdapter(
      new CommandKernel(store),
    ).saveReflection({
      operationId: operationOne,
      expectedVersion: 0,
      text: "This must not overwrite corrupt storage.",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "STORAGE_FAILURE", retry: "SAME_OPERATION_ID" },
      stateVersion: 0,
    });
    expect(storage.getItem(LOCAL_WORKSPACE_KEY)).toBe(corruptBytes);
  });

  it("returns a typed storage failure when the browser lock cannot be acquired", async () => {
    const storage = new MemoryStorage();
    const store = new LocalWorkspaceStore(
      storage,
      createEmptyWorkspace(),
      new FailingLockManager(),
    );
    const result = await createParticipantCommandAdapter(
      new CommandKernel(store),
    ).saveReflection({
      operationId: operationOne,
      expectedVersion: 0,
      text: "This write cannot acquire its lock.",
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "STORAGE_FAILURE",
        retry: "SAME_OPERATION_ID",
      },
      stateVersion: 0,
    });
    expect(storage.getItem(LOCAL_WORKSPACE_KEY)).toBeNull();
  });

  it("migrates a valid schema-v1 workspace in memory without overwriting its original bytes", () => {
    const storage = new MemoryStorage();
    const legacy = {
      id: "00000000-0000-4000-8000-000000000001",
      schemaVersion: 1,
      contractVersion: "1.0.0",
      stateVersion: 0,
      phase: "EXPLORING",
      participant: { displayName: "", focusQuestion: "", costCaps: { hoursPerWeek: 0, money: 0, currency: "XXX" } },
      reflections: [], hypotheses: [], experiments: [], evidence: [], revisions: [],
      planItems: [], outbox: [], teachings: [], operations: [],
    };
    const originalBytes = JSON.stringify(legacy);
    storage.setItem(LOCAL_WORKSPACE_KEY, originalBytes);
    const store = new LocalWorkspaceStore(storage, createEmptyWorkspace(), new SerialLockManager());

    expect(store.load()).toMatchObject({
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      contractVersion: CONTRACT_VERSION,
      routeProposalSets: [],
      hypotheses: [],
    });
    expect(storage.getItem(LOCAL_WORKSPACE_KEY)).toBe(originalBytes);
  });

  it("canonicalizes a schema-v1 save_reflection identity so an identical retry replays", async () => {
    const storage = new MemoryStorage();
    const legacy = {
      id: "00000000-0000-4000-8000-000000000001",
      schemaVersion: 1,
      contractVersion: "1.0.0",
      stateVersion: 1,
      phase: "EXPLORING",
      participant: { displayName: "", focusQuestion: "", costCaps: { hoursPerWeek: 0, money: 0, currency: "XXX" } },
      reflections: [{
        id: "00000000-0000-4000-8000-000000000100",
        ref: "reflection-1",
        availableActions: [],
        status: "confirmed",
        text: "Retry-safe migrated reflection.",
        recordedBy: "participant",
        createdAt: "2026-09-01T10:00:00.000Z",
      }],
      hypotheses: [], experiments: [], evidence: [], revisions: [], planItems: [], outbox: [], teachings: [],
      operations: [{
        operationId: operationOne,
        operationRef: "operation-1",
        actor: "participant",
        command: "save_reflection",
        effect: "APPLIED",
        beforeVersion: 0,
        afterVersion: 1,
        changedRefs: ["reflection-1"],
        at: "2026-09-01T10:00:00.000Z",
        requestIdentity: JSON.stringify({
          name: "save_reflection",
          actor: "participant",
          text: "Retry-safe migrated reflection.",
        }),
      }],
    };
    const originalBytes = JSON.stringify(legacy);
    storage.setItem(LOCAL_WORKSPACE_KEY, originalBytes);
    const store = new LocalWorkspaceStore(storage, createEmptyWorkspace(), new SerialLockManager());
    const result = await createParticipantCommandAdapter(new CommandKernel(store)).saveReflection({
      operationId: operationOne,
      expectedVersion: 1,
      text: "Retry-safe migrated reflection.",
    });

    expect(result).toMatchObject({
      ok: true,
      stateVersion: 1,
      receipt: { operationRef: "operation-1", afterVersion: 1 },
    });
    expect(result.guidance).toContain("Replay detected");
    expect(store.load().operations).toHaveLength(1);
    expect(storage.getItem(LOCAL_WORKSPACE_KEY)).toBe(originalBytes);
  });

  it("reloads a persisted P3 route proposal with its receipt intact", async () => {
    const storage = new MemoryStorage();
    const locks = new SerialLockManager();
    const firstStore = new LocalWorkspaceStore(storage, p3Workspace(), locks);
    const first = await new CommandKernel(firstStore).execute(
      { actor: "agent", proposalSource: "chatgpt_webmcp" },
      {
      name: "propose_route_set",
      input: {
        operationId: operationOne,
        expectedVersion: 0,
        outcome: "routes",
        routes: validRoutes(),
      },
      },
    );
    const reloaded = new LocalWorkspaceStore(storage, p3Workspace(), locks).load();

    expect(first.ok).toBe(true);
    expect(reloaded.routeProposalSets).toHaveLength(1);
    expect(reloaded.operations[0].operationId).toBe(operationOne);
    expect(reloaded.stateVersion).toBe(1);
  });
});

class SerialLockManager implements WorkspaceLockManager {
  private tail: Promise<void> = Promise.resolve();

  async request<T>(
    _name: string,
    callback: () => T | PromiseLike<T>,
  ): Promise<T> {
    const previous = this.tail;
    let release = () => {};
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await callback();
    } finally {
      release();
    }
  }
}

class FailingLockManager implements WorkspaceLockManager {
  request<T>(): Promise<T> {
    return Promise.reject(new Error("Simulated lock failure."));
  }
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
