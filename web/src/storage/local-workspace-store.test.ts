import { describe, expect, it } from "vitest";
import { createParticipantCommandAdapter } from "../adapters/participant-command-adapter";
import { CommandKernel } from "../commands/command-kernel";
import { createEmptyWorkspace } from "../domain/workspace";
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
