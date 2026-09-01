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

  it("matches the participant-confirmed golden fixture", () => {
    const { kernel, reader } = setup();
    createParticipantCommandAdapter(kernel).saveReflection({
      operationId: operationOne,
      expectedVersion: 0,
      text: "I enjoy making complicated systems understandable.",
    });

    expect(reader.readWorkspace({ view: "orientation" }).data).toEqual(confirmedGolden);
  });

  it("matches the proposed-content golden fixture and exposes the human boundary", () => {
    const { kernel, reader } = setup();
    createTestCommandAdapter(kernel).saveReflection({
      operationId: operationOne,
      expectedVersion: 0,
      text: "The participant said they prefer bounded experiments.",
    });

    expect(reader.readWorkspace({ view: "orientation" }).data).toEqual(proposedGolden);
  });

  it("returns only public changes after a caller-owned cursor", () => {
    const { kernel, reader } = setup();
    const initialRead = reader.readWorkspace();
    const cursor = initialRead.data?.view === "orientation" ? initialRead.data.cursor : "";
    createParticipantCommandAdapter(kernel).saveReflection({
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
    expect(workingSet.data.truncated).toBe(true);

    const targeted = reader.readWorkspace({
      view: "entities",
      refs: ["reflection-1", "reflection-missing"],
    });
    expect(targeted.data?.view).toBe("entities");
    if (targeted.data?.view !== "entities") return;
    expect(targeted.data.entities.map((entity) => entity.ref)).toEqual(["reflection-1"]);
    expect(targeted.data.missingRefs).toEqual(["reflection-missing"]);
  });

  it("keeps maximal-input orientation inside the declared token budget", () => {
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
    const store = new MemoryWorkspaceStore(workspaceSchema.parse({
      ...createEmptyWorkspace(),
      stateVersion: proposed.length,
      participant: { ...createEmptyWorkspace().participant, focusQuestion },
      reflections: proposed,
    }));
    const result = new WorkspaceReader(store).read({ view: "orientation" });
    const serializedLength = JSON.stringify(result.data).length;

    expect(serializedLength).toBeLessThanOrEqual(ORIENTATION_MAX_SERIALIZED_CHARS);
    expect(Math.ceil(serializedLength / 4)).toBeLessThanOrEqual(
      ORIENTATION_ESTIMATED_TOKEN_BUDGET,
    );
  });
});
