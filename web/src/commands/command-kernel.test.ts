import { describe, expect, it } from "vitest";
import { createParticipantCommandAdapter } from "../adapters/participant-command-adapter";
import { createTestCommandAdapter } from "../adapters/test-command-adapter";
import { createEmptyWorkspace, workspaceSchema, type Workspace } from "../domain/workspace";
import { MemoryWorkspaceStore } from "../storage/memory-workspace-store";
import { WorkspaceStoreError, type WorkspaceStore } from "../storage/workspace-store";
import { CommandKernel, type CommandEnvironment } from "./command-kernel";

const operationOne = "00000000-0000-4000-8000-000000000010";
const operationTwo = "00000000-0000-4000-8000-000000000020";
const reflectionId = "00000000-0000-4000-8000-000000000100";

function environment(): CommandEnvironment {
  return {
    now: () => "2026-09-01T10:00:00.000Z",
    createId: () => reflectionId,
  };
}

function setup(initial = createEmptyWorkspace()) {
  const store = new MemoryWorkspaceStore(initial);
  const kernel = new CommandKernel(store, environment());
  return { store, kernel };
}

describe("P1 save_reflection command spine", () => {
  it("gives the participant UI adapter and test adapter identical command semantics", () => {
    const participantRuntime = setup();
    const testRuntime = setup();
    const input = {
      operationId: operationOne,
      expectedVersion: 0,
      text: "I enjoy making complicated systems understandable.",
    };

    const participantResult = createParticipantCommandAdapter(
      participantRuntime.kernel,
    ).saveReflection(input);
    const testResult = createTestCommandAdapter(
      testRuntime.kernel,
      "participant",
    ).saveReflection(input);

    expect(testResult).toEqual(participantResult);
    expect(testRuntime.store.load()).toEqual(participantRuntime.store.load());
  });

  it("atomically saves one confirmed participant reflection and one public receipt", () => {
    const { store, kernel } = setup();
    const result = createParticipantCommandAdapter(kernel).saveReflection({
      operationId: operationOne,
      expectedVersion: 0,
      text: "  I enjoy making complicated systems understandable.  ",
    });

    expect(result.ok).toBe(true);
    expect(result.stateVersion).toBe(1);
    expect(result.data?.reflection).toMatchObject({
      ref: "reflection-1",
      status: "confirmed",
      recordedBy: "participant",
      text: "I enjoy making complicated systems understandable.",
    });
    expect(result.receipt).toMatchObject({
      operationId: operationOne,
      operationRef: "operation-1",
      effect: "APPLIED",
      beforeVersion: 0,
      afterVersion: 1,
      changedRefs: ["reflection-1"],
    });
    expect(result.receipt).not.toHaveProperty("requestIdentity");

    const afterState = store.load();
    expect(afterState.reflections).toHaveLength(1);
    expect(afterState.operations).toHaveLength(1);
    expect(afterState.stateVersion).toBe(1);
  });

  it("stores an agent transcription as a visible proposal", () => {
    const { store, kernel } = setup();
    const result = createTestCommandAdapter(kernel).saveReflection({
      operationId: operationOne,
      expectedVersion: 0,
      text: "The participant said they prefer bounded experiments.",
    });

    expect(result.ok).toBe(true);
    expect(result.data?.reflection.status).toBe("proposed");
    expect(result.data?.reflection.recordedBy).toBe("agent_transcribed");
    expect(result.receipt?.effect).toBe("PROPOSED");
    expect(store.load().stateVersion).toBe(1);
  });

  it("rejects malformed and extra fields without mutation", () => {
    const { store, kernel } = setup();
    const result = kernel.execute({
      name: "save_reflection",
      actor: "participant",
      input: {
        operationId: operationOne,
        expectedVersion: 0,
        text: "",
        hiddenWrite: true,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("MALFORMED_INPUT");
    expect(store.load()).toEqual(createEmptyWorkspace());
  });

  it("denies save_reflection outside EXPLORING", () => {
    const testingWorkspace = workspaceSchema.parse({
      ...createEmptyWorkspace(),
      phase: "TESTING",
    });
    const { store, kernel } = setup(testingWorkspace);
    const result = createParticipantCommandAdapter(kernel).saveReflection({
      operationId: operationOne,
      expectedVersion: 0,
      text: "This should not be written in the testing phase.",
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("WRONG_PHASE");
    expect(store.load().stateVersion).toBe(0);
  });

  it("returns stale-state guidance and changed refs without mutation", () => {
    const { store, kernel } = setup();
    const adapter = createParticipantCommandAdapter(kernel);
    adapter.saveReflection({
      operationId: operationOne,
      expectedVersion: 0,
      text: "First reflection.",
    });

    const stale = adapter.saveReflection({
      operationId: operationTwo,
      expectedVersion: 0,
      text: "A command based on an old read.",
    });

    expect(stale.ok).toBe(false);
    expect(stale.error).toMatchObject({
      code: "STALE_STATE",
      retry: "REREAD_THEN_NEW_OPERATION",
      changedRefs: ["reflection-1"],
    });
    expect(stale.stateVersion).toBe(1);
    expect(store.load().reflections).toHaveLength(1);
  });

  it("returns the original receipt for a same-intent replay without applying twice", () => {
    const { store, kernel } = setup();
    const adapter = createParticipantCommandAdapter(kernel);
    const first = adapter.saveReflection({
      operationId: operationOne,
      expectedVersion: 0,
      text: "Retry-safe reflection.",
    });
    const replay = adapter.saveReflection({
      operationId: operationOne,
      expectedVersion: 1,
      text: "Retry-safe reflection.",
    });

    expect(replay.ok).toBe(true);
    expect(replay.receipt).toEqual(first.receipt);
    expect(replay.guidance).toContain("Replay detected");
    expect(store.load().stateVersion).toBe(1);
    expect(store.load().reflections).toHaveLength(1);
    expect(store.load().operations).toHaveLength(1);
  });

  it("rejects reuse of an operation id for a different intent", () => {
    const { store, kernel } = setup();
    const adapter = createParticipantCommandAdapter(kernel);
    adapter.saveReflection({
      operationId: operationOne,
      expectedVersion: 0,
      text: "Original intent.",
    });
    const conflict = adapter.saveReflection({
      operationId: operationOne,
      expectedVersion: 1,
      text: "Different intent.",
    });

    expect(conflict.ok).toBe(false);
    expect(conflict.error?.code).toBe("OPERATION_CONFLICT");
    expect(store.load().stateVersion).toBe(1);
    expect(store.load().reflections[0].text).toBe("Original intent.");
  });

  it("reports persistence failure and retains the prior workspace", () => {
    const initial = createEmptyWorkspace();
    const store = new FailingSaveStore(initial);
    const kernel = new CommandKernel(store, environment());
    const result = createParticipantCommandAdapter(kernel).saveReflection({
      operationId: operationOne,
      expectedVersion: 0,
      text: "This write will fail.",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: "STORAGE_FAILURE",
      retry: "SAME_OPERATION_ID",
    });
    expect(store.load()).toEqual(initial);
  });
});

class FailingSaveStore implements WorkspaceStore {
  constructor(private readonly workspace: Workspace) {}

  load(): Workspace {
    return workspaceSchema.parse(this.workspace);
  }

  save(): void {
    throw new WorkspaceStoreError(
      "PERSISTENCE_FAILED",
      "Simulated quota failure.",
      this.workspace.stateVersion,
    );
  }
}
