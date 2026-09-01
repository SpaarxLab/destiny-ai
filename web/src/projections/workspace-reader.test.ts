import { describe, expect, it } from "vitest";
import { createParticipantCommandAdapter } from "../adapters/participant-command-adapter";
import { createTestCommandAdapter } from "../adapters/test-command-adapter";
import { createTestReadAdapter } from "../adapters/test-read-adapter";
import { CommandKernel, type CommandEnvironment } from "../commands/command-kernel";
import {
  ORIENTATION_ESTIMATED_TOKEN_BUDGET,
  ORIENTATION_MAX_SERIALIZED_CHARS,
  READ_ENTITY_LIMIT,
} from "../domain/reads";
import { createEmptyWorkspace, workspaceSchema } from "../domain/workspace";
import { MemoryWorkspaceStore } from "../storage/memory-workspace-store";
import type { WorkspaceStore } from "../storage/workspace-store";
import coldGolden from "./fixtures/cold-orientation.json";
import confirmedGolden from "./fixtures/confirmed-orientation.json";
import proposedGolden from "./fixtures/proposed-orientation.json";
import { WorkspaceReader } from "./workspace-reader";

const operationOne = "00000000-0000-4000-8000-000000000010";

const environment: CommandEnvironment = {
  now: () => "2026-09-01T10:00:00.000Z",
  createId: () => "00000000-0000-4000-8000-000000000100",
};

function setup() {
  const store = new MemoryWorkspaceStore(createEmptyWorkspace());
  const kernel = new CommandKernel(store, environment);
  const reader = createTestReadAdapter(new WorkspaceReader(store));
  return { store, kernel, reader };
}

describe("P2 read_workspace cold orientation", () => {
  it("matches the cold orientation golden fixture for an omitted/default view", () => {
    const { reader } = setup();
    const result = reader.readWorkspace();

    expect(result.ok).toBe(true);
    expect(result.data).toEqual(coldGolden);
    expect(result).not.toHaveProperty("receipt");
  });

  it("matches the participant-confirmed golden fixture", async () => {
    const { kernel, reader } = setup();
    await createParticipantCommandAdapter(kernel).saveReflection({
      operationId: operationOne,
      expectedVersion: 0,
      text: "I enjoy making complicated systems understandable.",
    });

    expect(reader.readWorkspace({ view: "orientation" }).data).toEqual(confirmedGolden);
  });

  it("matches the proposed-content golden fixture and exposes the human boundary", async () => {
    const { kernel, reader } = setup();
    await createTestCommandAdapter(kernel).saveReflection({
      operationId: operationOne,
      expectedVersion: 0,
      text: "The participant said they prefer bounded experiments.",
    });

    expect(reader.readWorkspace({ view: "orientation" }).data).toEqual(proposedGolden);
  });

  it("returns only public changes after a caller-owned cursor", async () => {
    const { kernel, reader } = setup();
    const initialRead = reader.readWorkspace();
    const cursor = initialRead.data?.view === "orientation" ? initialRead.data.cursor : "";
    await createParticipantCommandAdapter(kernel).saveReflection({
      operationId: operationOne,
      expectedVersion: 0,
      text: "A change after the cold read.",
    });

    const result = reader.readWorkspace({ view: "orientation", sinceCursor: cursor });
    expect(result.data?.view).toBe("orientation");
    if (result.data?.view !== "orientation") return;
    expect(result.data.changes.items).toEqual([
      {
        operationRef: "operation-1",
        command: "save_reflection",
        effect: "APPLIED",
        afterVersion: 1,
        changedRefs: ["reflection-1"],
        changedRefsTruncated: false,
        at: "2026-09-01T10:00:00.000Z",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("requestIdentity");
    expect(JSON.stringify(result)).not.toContain(operationOne);
  });

  it("rejects malformed, future, and cross-workspace cursors without mutation", () => {
    const { store, reader } = setup();
    const before = store.load();

    expect(reader.readWorkspace({ view: "orientation", hidden: true } as never).error?.code)
      .toBe("MALFORMED_INPUT");
    expect(reader.readWorkspace({
      view: "orientation",
      sinceCursor: `workspace:${before.id}:v1`,
    }).error?.code).toBe("INVALID_CURSOR");
    expect(reader.readWorkspace({
      view: "orientation",
      sinceCursor: "workspace:00000000-0000-4000-8000-000000000999:v0",
    }).error?.code).toBe("INVALID_CURSOR");
    expect(store.load()).toEqual(before);
  });

  it("supports bounded working-set and targeted entity reads", () => {
    const reflections = Array.from({ length: READ_ENTITY_LIMIT + 1 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      ref: `reflection-${index + 1}`,
      availableActions: [],
      status: "confirmed" as const,
      text: `Reflection ${index + 1}`,
      recordedBy: "participant" as const,
      createdAt: "2026-09-01T10:00:00.000Z",
    }));
    const store = new MemoryWorkspaceStore(workspaceSchema.parse({
      ...createEmptyWorkspace(),
      stateVersion: reflections.length,
      reflections,
    }));
    const reader = createTestReadAdapter(new WorkspaceReader(store));

    const workingSet = reader.readWorkspace({ view: "working_set" });
    expect(workingSet.data?.view).toBe("working_set");
    if (workingSet.data?.view !== "working_set") return;
    expect(workingSet.data.reflections).toHaveLength(READ_ENTITY_LIMIT);
    expect(workingSet.data.reflections.map((reflection) => reflection.ref)).toEqual(
      reflections.slice(-READ_ENTITY_LIMIT).map((reflection) => reflection.ref),
    );
    expect(workingSet.data.truncated).toBe(true);
    expect(workingSet.data.identity.stateVersion).toBe(workingSet.stateVersion);
    expect(workingSet.data.availableActions).toEqual(workingSet.nextActions);

    const targeted = reader.readWorkspace({
      view: "entities",
      refs: ["reflection-1", "reflection-1", "reflection-missing", "reflection-missing"],
    });
    expect(targeted.data?.view).toBe("entities");
    if (targeted.data?.view !== "entities") return;
    expect(targeted.data.entities.map((entity) => entity.ref)).toEqual(["reflection-1"]);
    expect(targeted.data.missingRefs).toEqual(["reflection-missing"]);
    expect(targeted.data.identity.stateVersion).toBe(targeted.stateVersion);
    expect(targeted.data.availableActions).toEqual(targeted.nextActions);
  });

  it("bounds and orders large change and pending-interaction projections", () => {
    const focusQuestion = "F".repeat(500);
    const proposed = Array.from({ length: 25 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      ref: `reflection-${index + 1}`,
      availableActions: [],
      status: "proposed" as const,
      text: "P".repeat(2_000),
      recordedBy: "agent_transcribed" as const,
      createdAt: "2026-09-01T10:00:00.000Z",
    }));
    const operations = proposed.map((reflection, index) => ({
      operationId: `00000000-0000-4000-8000-${String(index + 101).padStart(12, "0")}`,
      operationRef: `operation-${index + 1}-${"O".repeat(100)}`,
      actor: "agent" as const,
      command: "save_reflection",
      effect: "PROPOSED" as const,
      beforeVersion: index,
      afterVersion: index + 1,
      changedRefs: Array.from({ length: 5 }, (_, refIndex) =>
        proposed[(index + refIndex) % proposed.length].ref),
      at: "2026-09-01T10:00:00.000Z",
      requestIdentity: `INTERNAL-SECRET-${index}`,
    }));
    const workspace = workspaceSchema.parse({
      ...createEmptyWorkspace(),
      stateVersion: proposed.length,
      participant: { ...createEmptyWorkspace().participant, focusQuestion },
      reflections: proposed,
      operations,
    });
    const store = new MemoryWorkspaceStore(workspace);
    const result = new WorkspaceReader(store).read({
      view: "orientation",
      sinceCursor: `workspace:${workspace.id}:v0`,
    });
    const serialized = JSON.stringify(result);
    const serializedLength = serialized.length;
    const serializedBytes = new TextEncoder().encode(serialized).length;

    expect(result.data?.view).toBe("orientation");
    if (result.data?.view !== "orientation") return;
    expect(result.data.changes.truncated).toBe(true);
    expect(result.data.pendingHumanInteractions.truncated).toBe(true);
    expect(result.data.changes.items[0]?.afterVersion).toBe(1);
    expect(result.data.changes.items.map((change) => change.afterVersion)).toEqual(
      [...result.data.changes.items.map((change) => change.afterVersion)].sort((a, b) => a - b),
    );
    expect(result.data.cursor).toBe(
      `workspace:${workspace.id}:v${result.data.changes.items.at(-1)?.afterVersion ?? 0}`,
    );
    expect(serializedLength).toBeLessThanOrEqual(ORIENTATION_MAX_SERIALIZED_CHARS);
    expect(serializedBytes).toBeLessThanOrEqual(ORIENTATION_ESTIMATED_TOKEN_BUDGET);
    expect(JSON.stringify(result)).not.toContain("INTERNAL-SECRET");
    expect(JSON.stringify(result)).not.toContain(operations[0].operationId);
  });

  it("pages every change without stranding an omitted operation", () => {
    const operations = Array.from({ length: READ_ENTITY_LIMIT + 5 }, (_, index) => ({
      operationId: `00000000-0000-4000-8000-${String(index + 101).padStart(12, "0")}`,
      operationRef: `operation-${index + 1}`,
      actor: "participant" as const,
      command: "save_reflection",
      effect: "APPLIED" as const,
      beforeVersion: index,
      afterVersion: index + 1,
      changedRefs: [`reflection-${index + 1}`],
      at: "2026-09-01T10:00:00.000Z",
      requestIdentity: `internal-${index + 1}`,
    }));
    const workspace = workspaceSchema.parse({
      ...createEmptyWorkspace(),
      stateVersion: operations.length,
      reflections: operations.map((operation, index) => ({
        id: `00000000-0000-4000-8000-${String(index + 301).padStart(12, "0")}`,
        ref: operation.changedRefs[0],
        availableActions: [],
        status: "confirmed" as const,
        text: `Historical reflection ${index + 1}`,
        recordedBy: "participant" as const,
        createdAt: "2026-09-01T10:00:00.000Z",
      })),
      operations,
    });
    const reader = new WorkspaceReader(new MemoryWorkspaceStore(workspace));
    let cursor = `workspace:${workspace.id}:v0`;
    const deliveredVersions: number[] = [];

    for (let page = 0; page < operations.length; page += 1) {
      const result = reader.read({ view: "orientation", sinceCursor: cursor });
      expect(result.data?.view).toBe("orientation");
      if (result.data?.view !== "orientation") return;
      expect(result.data.changes.items.length).toBeGreaterThan(0);
      deliveredVersions.push(...result.data.changes.items.map((change) => change.afterVersion));
      cursor = result.data.cursor;
      if (!result.data.changes.truncated) break;
    }

    expect(deliveredVersions).toEqual(Array.from({ length: operations.length }, (_, index) => index + 1));
    expect(cursor).toBe(`workspace:${workspace.id}:v25`);
  });

  it("advances past one operation with maximal changed refs", () => {
    const workspace = workspaceSchema.parse({
      ...createEmptyWorkspace(),
      participant: {
        ...createEmptyWorkspace().participant,
        focusQuestion: "界".repeat(500),
      },
      stateVersion: 1,
      operations: [{
        operationId: "00000000-0000-4000-8000-000000000901",
        operationRef: "operation-maximal",
        actor: "participant",
        command: "save_reflection",
        effect: "APPLIED",
        beforeVersion: 0,
        afterVersion: 1,
        changedRefs: Array.from(
          { length: READ_ENTITY_LIMIT },
          () => createEmptyWorkspace().id,
        ),
        at: "2026-09-01T10:00:00.000Z",
        requestIdentity: "internal-maximal",
      }],
    });
    const result = new WorkspaceReader(new MemoryWorkspaceStore(workspace)).read({
      view: "orientation",
      sinceCursor: `workspace:${workspace.id}:v0`,
    });

    expect(result.data?.view).toBe("orientation");
    if (result.data?.view !== "orientation") return;
    expect(result.data.changes.items).toHaveLength(1);
    expect(result.data.changes.items[0].changedRefs.length).toBeLessThanOrEqual(5);
    expect(result.data.changes.items[0].changedRefsTruncated).toBe(true);
    expect(result.data.cursor).toBe(`workspace:${workspace.id}:v1`);
    expect(new TextEncoder().encode(JSON.stringify(result)).length).toBeLessThanOrEqual(
      ORIENTATION_ESTIMATED_TOKEN_BUDGET,
    );
  });

  it.each([
    ["unknown view", { view: "unknown" }],
    ["empty entity refs", { view: "entities", refs: [] }],
    [
      "too many entity refs",
      {
        view: "entities",
        refs: Array.from({ length: READ_ENTITY_LIMIT + 1 }, (_, index) => `reflection-${index}`),
      },
    ],
    ["extra working-set fields", { view: "working_set", refs: ["reflection-1"] }],
    ["extra entity fields", { view: "entities", refs: ["reflection-1"], hidden: true }],
  ])("rejects %s", (_case, input) => {
    const { reader } = setup();
    expect(reader.readWorkspace(input as never).error?.code).toBe("MALFORMED_INPUT");
  });

  it("keeps every successful read view mutation-free and receipt-free", () => {
    const { store, reader } = setup();
    const before = store.load();
    const inputs = [
      { view: "orientation" as const },
      { view: "working_set" as const },
      { view: "entities" as const, refs: ["reflection-missing"] },
    ];

    for (const input of inputs) {
      const result = reader.readWorkspace(input);
      expect(result.ok).toBe(true);
      expect(result).not.toHaveProperty("receipt");
      expect(store.load()).toEqual(before);
    }
  });

  it("returns a typed storage failure when current truth cannot be loaded", () => {
    const failingStore: WorkspaceStore = {
      load() {
        throw new Error("Simulated unreadable workspace.");
      },
      save() {},
    };

    expect(new WorkspaceReader(failingStore).read()).toMatchObject({
      ok: false,
      error: { code: "STORAGE_FAILURE", retry: "NEVER" },
      stateVersion: 0,
    });
  });
});
