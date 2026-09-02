import { describe, expect, it } from "vitest";
import {
  METHOD_VERSION,
  agentCapabilityCopy,
  methodGuideResultSchema,
  webMcpReadWorkspaceResultSchema,
} from "./contracts";
import { WebMcpRegistrationManager, runtimeResolverFor } from "./lifecycle";
import { agentStatusCopy } from "./registrar";
import { detectModelContext } from "./runtime";
import { FakeWebMcpRuntime, createWebMcpHarness } from "./testing/fake-runtime";
import { READ_WORKSPACE_INPUT_SCHEMA } from "./tools";
import type { AgentActivityEvent } from "./activity";
import {
  READ_ENTITY_LIMIT,
  ORIENTATION_ESTIMATED_TOKEN_BUDGET,
  ORIENTATION_MAX_SERIALIZED_CHARS,
  type OrientationProjection,
} from "../domain/reads";
import { CONTRACT_VERSION, createEmptyWorkspace, createFreshWorkspace, workspaceSchema } from "../domain/workspace";
import { WorkspaceReader } from "../projections/workspace-reader";
import { MemoryWorkspaceStore } from "../storage/memory-workspace-store";
import { CommandKernel } from "../commands/command-kernel";
import { createWebMcpCommandAdapter } from "../adapters/webmcp-command-adapter";

function setup(workspace = createEmptyWorkspace()) {
  const store = new MemoryWorkspaceStore(workspace);
  const reader = new WorkspaceReader(store);
  return { store, reader };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("P8A native WebMCP foundation", () => {
  it("feature-detects document.modelContext and fails closed when absent", async () => {
    const runtime = new FakeWebMcpRuntime();
    expect(detectModelContext(undefined)).toBeNull();
    expect(detectModelContext({})).toBeNull();
    expect(detectModelContext({ modelContext: runtime })).toBe(runtime);

    const { reader } = setup();
    const manager = new WebMcpRegistrationManager(() => null);
    await expect(manager.replace(reader)).resolves.toEqual({ status: "unsupported" });
    expect(agentStatusCopy({ status: "unsupported" })).toBe("Human mode");
    expect(agentCapabilityCopy(null, { status: "unsupported" })).toBe("Human mode: no agent connected.");
  });

  it("describes browser capability without claiming that ChatGPT has connected", () => {
    expect(agentStatusCopy({ status: "registered", toolNames: ["read_workspace"] }))
      .toBe("Agent tools ready");
  });

  it("registers the exact read-only catalogue with strict input schemas", async () => {
    const { reader } = setup();
    const { runtime, registration } = await createWebMcpHarness(reader);

    expect(registration).toEqual({
      status: "registered",
      toolNames: ["read_workspace", "get_method_guide"],
    });
    expect(runtime.activeToolNames()).toEqual(["read_workspace", "get_method_guide"]);
    expect(runtime.latest("read_workspace").annotations).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
    });
    expect(runtime.latest("get_method_guide").annotations).toEqual({ readOnlyHint: true });
    expect(runtime.latest("read_workspace").description).toContain("confirmedWords");
    expect(runtime.latest("read_workspace").description).toContain("proposal availability");
    expect(runtime.latest("read_workspace").description).toContain("follow-up questions");
    expect(READ_WORKSPACE_INPUT_SCHEMA.oneOf).toHaveLength(3);
    expect(READ_WORKSPACE_INPUT_SCHEMA.oneOf.every((schema) =>
      schema.additionalProperties === false)).toBe(true);
    expect(READ_WORKSPACE_INPUT_SCHEMA.oneOf[1].properties).toHaveProperty(
      "omittedRefsCursor",
    );
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

    await manager.replace(reader);
    const cachedRead = runtime.cached("read_workspace");
    await manager.replace(reader);

    expect(runtime.activeToolNames()).toEqual(["read_workspace", "get_method_guide"]);
    expect(await cachedRead.execute({})).toMatchObject({
      ok: false,
      error: { code: "STALE_REGISTRATION" },
      guidance: expect.stringContaining("stale"),
    });
    expect(await runtime.invoke("read_workspace", {})).toMatchObject({ ok: true });
  });

  it("aborts cleanly across unmount, remount, and navigation-style replacement", async () => {
    const { reader } = setup();
    const runtime = new FakeWebMcpRuntime();
    const firstPage = new WebMcpRegistrationManager(() => runtime);
    await firstPage.replace(reader);
    firstPage.stop();
    expect(runtime.activeToolNames()).toEqual([]);

    const nextPage = new WebMcpRegistrationManager(() => runtime);
    await nextPage.replace(reader);
    expect(runtime.activeToolNames()).toEqual(["read_workspace", "get_method_guide"]);
    nextPage.stop();
    expect(runtime.activeToolNames()).toEqual([]);
  });

  it("awaits the whole catalogue and aborts it when the second registration rejects", async () => {
    const { reader } = setup();
    const runtime = new FakeWebMcpRuntime(async (_tool, index) => {
      if (index === 1) throw new Error("fake registration failure");
    });
    const manager = new WebMcpRegistrationManager(() => runtime);

    await expect(manager.replace(reader)).resolves.toEqual({
      status: "failed",
      message: "fake registration failure",
    });
    expect(runtime.activeToolNames()).toEqual([]);
  });

  it("does not report success until every native registration promise resolves", async () => {
    const { reader } = setup();
    const gates = [deferred(), deferred()];
    const runtime = new FakeWebMcpRuntime((_tool, index) => gates[index].promise);
    const manager = new WebMcpRegistrationManager(() => runtime);
    let settled = false;

    const pending = manager.replace(reader).then((result) => {
      settled = true;
      return result;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(runtime.activeToolNames()).toEqual([]);

    gates[0].resolve();
    gates[1].resolve();
    await expect(pending).resolves.toEqual({
      status: "registered",
      toolNames: ["read_workspace", "get_method_guide"],
    });
    expect(runtime.activeToolNames()).toEqual(["read_workspace", "get_method_guide"]);
  });

  it("suppresses late success after stop while registration is pending", async () => {
    const { reader } = setup();
    const gates = [deferred(), deferred()];
    const runtime = new FakeWebMcpRuntime((_tool, index) => gates[index].promise);
    const manager = new WebMcpRegistrationManager(() => runtime);

    const pending = manager.replace(reader);
    await Promise.resolve();
    manager.stop();
    gates[0].resolve();
    gates[1].resolve();

    await expect(pending).resolves.toBeNull();
    expect(runtime.activeToolNames()).toEqual([]);
  });

  it("suppresses a superseded registration after its promises resolve late", async () => {
    const { reader } = setup();
    const firstGeneration = [deferred(), deferred()];
    const runtime = new FakeWebMcpRuntime((_tool, index) =>
      index < 2 ? firstGeneration[index].promise : Promise.resolve());
    const manager = new WebMcpRegistrationManager(() => runtime);

    const stale = manager.replace(reader);
    await Promise.resolve();
    const current = manager.replace(reader);
    await expect(current).resolves.toMatchObject({ status: "registered" });

    firstGeneration[0].resolve();
    firstGeneration[1].resolve();
    await expect(stale).resolves.toBeNull();
    expect(runtime.activeToolNames()).toEqual(["read_workspace", "get_method_guide"]);
  });

  it("returns the same bounded orientation as the UI reader without mutation", async () => {
    const { store, reader } = setup();
    const before = store.load();
    const uiOrientation = reader.read({ view: "orientation" });
    const { runtime } = await createWebMcpHarness(reader);
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
      reflections,
    });
    const { runtime } = await createWebMcpHarness(
      new WorkspaceReader(new MemoryWorkspaceStore(workspace)),
    );

    const workingSet = webMcpReadWorkspaceResultSchema.parse(
      await runtime.invoke("read_workspace", { view: "working_set" }),
    );
    expect(workingSet.data?.view).toBe("working_set");
    if (workingSet.data?.view === "working_set") {
      expect(workingSet.data.entities).toHaveLength(READ_ENTITY_LIMIT);
      expect(workingSet.data.truncated).toBe(true);
    }

    const malformed = webMcpReadWorkspaceResultSchema.parse(
      await runtime.invoke("read_workspace", { view: "orientation", hidden: true }),
    );
    expect(malformed).toMatchObject({ ok: false, error: { code: "MALFORMED_INPUT" } });
  });

  it("returns the operational versioned method guide and rejects extra input", async () => {
    const base = createEmptyWorkspace();
    const workspace = workspaceSchema.parse({
      ...base,
      stateVersion: 7,
      operations: Array.from({ length: 7 }, (_, index) => ({
        operationId: `00000000-0000-4000-8000-${String(index + 801).padStart(12, "0")}`,
        operationRef: `operation-guide-${index + 1}`,
        actor: "participant" as const,
        command: "save_reflection",
        effect: "APPLIED" as const,
        beforeVersion: index,
        afterVersion: index + 1,
        changedRefs: [base.id],
        at: "2026-09-01T10:00:00.000Z",
        requestIdentity: `internal-guide-${index + 1}`,
      })),
    });
    const { reader } = setup(workspace);
    const { runtime } = await createWebMcpHarness(reader);

    const guide = methodGuideResultSchema.parse(await runtime.invoke("get_method_guide", {}));
    expect(guide.data).toMatchObject({
      methodVersion: METHOD_VERSION,
      contractVersion: CONTRACT_VERSION,
    });
    expect(guide.data.steps.length).toBeGreaterThanOrEqual(8);
    expect(guide.data.steps.join(" ")).toContain("exact substring");
    expect(guide.data.steps.join(" ")).toContain("carryRouteRef");
    expect(guide.data.steps.join(" ")).toContain("insufficient_signal");
    expect(guide.data.steps.join(" ")).toContain("STALE_STATE");
    expect(guide.data.exampleInput).toMatchObject({ outcome: "routes" });
    expect(guide.stateVersion).toBe(7);
    expect(await runtime.invoke("get_method_guide", { hidden: true })).toMatchObject({
      ok: false,
      error: { code: "MALFORMED_INPUT" },
      stateVersion: 7,
    });
  });

  it("supports deterministic document injection for the in-page harness", async () => {
    const { reader } = setup();
    const runtime = new FakeWebMcpRuntime();
    const manager = new WebMcpRegistrationManager(
      runtimeResolverFor({ modelContext: runtime }),
    );

    await expect(manager.replace(reader)).resolves.toMatchObject({ status: "registered" });
    expect(runtime.activeToolNames()).toEqual(["read_workspace", "get_method_guide"]);
  });

  it("emits one participant-readable activity event per read invocation", async () => {
    const { reader } = setup();
    const runtime = new FakeWebMcpRuntime();
    const manager = new WebMcpRegistrationManager(() => runtime);
    const events: AgentActivityEvent[] = [];
    await manager.replace(reader, { onAgentActivity: (event) => events.push(event) });

    await runtime.invoke("read_workspace", { view: "orientation" });
    await runtime.invoke("get_method_guide", {});
    await runtime.invoke("read_workspace", { view: "orientation", hidden: true });

    expect(events.map((event) => [event.tool, event.outcome, event.effect])).toEqual([
      ["read_workspace", "ok", "READ"],
      ["get_method_guide", "ok", "READ"],
      ["read_workspace", "denied", "NONE"],
    ]);
    for (const event of events) {
      expect(event.summary).not.toMatch(/read_workspace|get_method_guide|propose_route_set/);
      expect(event.id).toBeTruthy();
      expect(event.at).toBeTruthy();
    }
  });

  it("refreshes the visible workspace and activity rail after a Deck mutation", async () => {
    const { store, reader } = setup(createFreshWorkspace());
    const runtime = new FakeWebMcpRuntime();
    const manager = new WebMcpRegistrationManager(() => runtime);
    const events: AgentActivityEvent[] = [];
    const refreshedVersions: number[] = [];
    await manager.replace(reader, {
      commandAdapter: createWebMcpCommandAdapter(new CommandKernel(store)),
      onWorkspaceChanged: (stateVersion) => refreshedVersions.push(stateVersion),
      onAgentActivity: (event) => events.push(event),
    });

    const result = await runtime.invoke("post_dealer_note", {
      operationId: "8a0a0000-0000-4000-8000-000000000012",
      expectedVersion: 0,
      role: "dealer",
      text: "The agent proposes this note; the participant decides whether it stays.",
    });

    expect(result).toMatchObject({ ok: true, stateVersion: 1, receipt: { command: "post_dealer_note", effect: "PROPOSED" } });
    expect(refreshedVersions).toEqual([1]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ tool: "post_dealer_note", outcome: "ok", effect: "PROPOSED", stateVersion: 1 });
    expect(events[0].summary).not.toContain("post_dealer_note");
    expect(store.load().dealerNotes[0]).toMatchObject({ status: "visible", postedBy: { source: "other_webmcp" } });
  });

  it("describes capability from the same orientation the agent reads", () => {
    const { reader } = setup();
    const result = reader.read({ view: "orientation" });
    const orientation = result.data as OrientationProjection;
    expect(agentCapabilityCopy(orientation, { status: "registered" })).toBe("ChatGPT can read your room.");
    expect(agentCapabilityCopy(orientation, { status: "failed" })).toContain("could not connect");
  });
});
