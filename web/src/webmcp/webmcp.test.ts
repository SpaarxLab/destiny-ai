import { describe, expect, it } from "vitest";
import {
  METHOD_VERSION,
  methodGuideResultSchema,
  webMcpReadWorkspaceResultSchema,
} from "./contracts";
import { WebMcpRegistrationManager, runtimeResolverFor } from "./lifecycle";
import { agentStatusCopy } from "./registrar";
import { detectModelContext, type WebMcpModelContext } from "./runtime";
import { FakeWebMcpRuntime, createWebMcpHarness } from "./testing/fake-runtime";
import { READ_WORKSPACE_INPUT_SCHEMA } from "./tools";
import {
  READ_ENTITY_LIMIT,
  ORIENTATION_ESTIMATED_TOKEN_BUDGET,
  ORIENTATION_MAX_SERIALIZED_CHARS,
} from "../domain/reads";
import { CONTRACT_VERSION, createEmptyWorkspace, workspaceSchema } from "../domain/workspace";
import { WorkspaceReader } from "../projections/workspace-reader";
import { MemoryWorkspaceStore } from "../storage/memory-workspace-store";

function setup(workspace = createEmptyWorkspace()) {
  const store = new MemoryWorkspaceStore(workspace);
  const reader = new WorkspaceReader(store);
  return { store, reader };
}

describe("P8A native WebMCP foundation", () => {
  it("feature-detects document.modelContext and fails closed when absent", () => {
    const runtime = new FakeWebMcpRuntime();
    expect(detectModelContext(undefined)).toBeNull();
    expect(detectModelContext({})).toBeNull();
    expect(detectModelContext({ modelContext: runtime })).toBe(runtime);

    const { reader } = setup();
    const manager = new WebMcpRegistrationManager(() => null);
    expect(manager.replace(reader)).toEqual({ status: "unsupported" });
    expect(agentStatusCopy({ status: "unsupported" })).toBe(
      "Agent tools not detected · Human mode",
    );
  });

  it("registers the exact read-only catalogue with strict input schemas", () => {
    const { reader } = setup();
    const { runtime, registration } = createWebMcpHarness(reader);

    expect(registration).toEqual({
      status: "registered",
      toolNames: ["read_workspace", "get_method_guide"],
    });
    expect(runtime.activeToolNames()).toEqual(["read_workspace", "get_method_guide"]);
    expect(runtime.latest("read_workspace").annotations).toEqual({ readOnlyHint: true });
    expect(runtime.latest("get_method_guide").annotations).toEqual({ readOnlyHint: true });
    expect(READ_WORKSPACE_INPUT_SCHEMA.oneOf).toHaveLength(3);
    expect(READ_WORKSPACE_INPUT_SCHEMA.oneOf.every((schema) =>
      schema.additionalProperties === false)).toBe(true);
    expect(runtime.latest("get_method_guide").inputSchema).toEqual({
      type: "object",
      properties: {},
      additionalProperties: false,
    });
  });

  it("replaces registrations by aborting the old catalogue and denies cached calls", async () => {
    const { reader } = setup();
    const runtime = new FakeWebMcpRuntime();
    const manager = new WebMcpRegistrationManager(() => runtime);

    manager.replace(reader);
    const cachedRead = runtime.cached("read_workspace");
    manager.replace(reader);

    expect(runtime.activeToolNames()).toEqual(["read_workspace", "get_method_guide"]);
    expect(await cachedRead.execute({})).toMatchObject({
      ok: false,
      error: { code: "STALE_REGISTRATION" },
      guidance: expect.stringContaining("stale"),
    });
    expect(await runtime.invoke("read_workspace", {})).toMatchObject({ ok: true });
  });

  it("aborts cleanly across unmount, remount, and navigation-style replacement", () => {
    const { reader } = setup();
    const runtime = new FakeWebMcpRuntime();
    const firstPage = new WebMcpRegistrationManager(() => runtime);
    firstPage.replace(reader);
    firstPage.stop();
    expect(runtime.activeToolNames()).toEqual([]);

    const nextPage = new WebMcpRegistrationManager(() => runtime);
    nextPage.replace(reader);
    expect(runtime.activeToolNames()).toEqual(["read_workspace", "get_method_guide"]);
    nextPage.stop();
    expect(runtime.activeToolNames()).toEqual([]);
  });

  it("aborts the whole batch if native registration fails", () => {
    const { reader } = setup();
    let calls = 0;
    const runtime: WebMcpModelContext = {
      registerTool() {
        calls += 1;
        if (calls === 2) throw new Error("fake registration failure");
      },
    };
    const manager = new WebMcpRegistrationManager(() => runtime);

    expect(manager.replace(reader)).toEqual({
      status: "failed",
      message: "fake registration failure",
    });
  });

  it("returns the same bounded orientation as the UI reader without mutation", async () => {
    const { store, reader } = setup();
    const before = store.load();
    const uiOrientation = reader.read({ view: "orientation" });
    const { runtime } = createWebMcpHarness(reader);
    const agentOrientation = await runtime.invoke("read_workspace", { view: "orientation" });

    expect(webMcpReadWorkspaceResultSchema.parse(agentOrientation)).toEqual(uiOrientation);
    expect(JSON.stringify(agentOrientation).length).toBeLessThanOrEqual(
      ORIENTATION_MAX_SERIALIZED_CHARS,
    );
    expect(new TextEncoder().encode(JSON.stringify(agentOrientation)).length).toBeLessThanOrEqual(
      ORIENTATION_ESTIMATED_TOKEN_BUDGET,
    );
    expect(store.load()).toEqual(before);
  });

  it("preserves working-set bounds and typed malformed-input failures", async () => {
    const reflections = Array.from({ length: READ_ENTITY_LIMIT + 1 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      ref: `reflection-${index + 1}`,
      availableActions: [],
      status: "confirmed" as const,
      text: `Reflection ${index + 1}`,
      recordedBy: "participant" as const,
      createdAt: "2026-09-01T10:00:00.000Z",
    }));
    const workspace = workspaceSchema.parse({
      ...createEmptyWorkspace(),
      stateVersion: reflections.length,
      reflections,
    });
    const { runtime } = createWebMcpHarness(new WorkspaceReader(new MemoryWorkspaceStore(workspace)));

    const workingSet = webMcpReadWorkspaceResultSchema.parse(
      await runtime.invoke("read_workspace", { view: "working_set" }),
    );
    expect(workingSet.data?.view).toBe("working_set");
    if (workingSet.data?.view === "working_set") {
      expect(workingSet.data.reflections).toHaveLength(READ_ENTITY_LIMIT);
      expect(workingSet.data.truncated).toBe(true);
    }

    const malformed = webMcpReadWorkspaceResultSchema.parse(
      await runtime.invoke("read_workspace", { view: "orientation", hidden: true }),
    );
    expect(malformed).toMatchObject({ ok: false, error: { code: "MALFORMED_INPUT" } });
  });

  it("returns the versioned method guide and rejects extra input", async () => {
    const { reader } = setup();
    const { runtime } = createWebMcpHarness(reader);

    const guide = methodGuideResultSchema.parse(await runtime.invoke("get_method_guide", {}));
    expect(guide.data).toMatchObject({
      methodVersion: METHOD_VERSION,
      contractVersion: CONTRACT_VERSION,
    });
    expect(await runtime.invoke("get_method_guide", { hidden: true })).toMatchObject({
      ok: false,
      error: { code: "MALFORMED_INPUT" },
    });
  });

  it("supports deterministic document injection for the in-page harness", () => {
    const { reader } = setup();
    const runtime = new FakeWebMcpRuntime();
    const manager = new WebMcpRegistrationManager(
      runtimeResolverFor({ modelContext: runtime }),
    );

    expect(manager.replace(reader).status).toBe("registered");
    expect(runtime.activeToolNames()).toEqual(["read_workspace", "get_method_guide"]);
  });
});
