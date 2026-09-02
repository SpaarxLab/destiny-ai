import { describe, expect, it } from "vitest";
import { createParticipantCommandAdapter } from "../adapters/participant-command-adapter";
import { createWebMcpCommandAdapter } from "../adapters/webmcp-command-adapter";
import { CommandKernel } from "../commands/command-kernel";
import { createFreshWorkspace } from "../domain/workspace";
import { MemoryWorkspaceStore } from "../storage/memory-workspace-store";
import { createRunProbeTool } from "./tools/run-probe";

const INPUT = {
  operationId: "8a0a0000-0000-4000-8000-000000000101",
  expectedVersion: 0,
  waitMs: 10_000,
  probe: {
    text: "Your calendar is empty until Thursday. You smile.",
    axis: "autonomy_belonging" as const,
    pole: "a" as const,
    kind: "moment" as const,
    reasons: ["I want room to make the call myself.", "The uninterrupted time feels energising.", "Owning the outcome makes this meaningful."] as [string, string, string],
  },
};

function setup() {
  const store = new MemoryWorkspaceStore(createFreshWorkspace());
  const kernel = new CommandKernel(store);
  return { store, participant: createParticipantCommandAdapter(kernel), agent: createWebMcpCommandAdapter(kernel) };
}

describe("run_probe rendezvous", () => {
  it("waits for the webpage response and returns both authoritative receipts", async () => {
    const { store, participant, agent } = setup();
    const controller = new AbortController();
    const refreshed: number[] = [];
    const tool = createRunProbeTool(agent, controller.signal, { loadWorkspace: () => store.load(), onWorkspaceChanged: (version) => refreshed.push(version) });

    const pending = tool.execute(INPUT) as Promise<Record<string, unknown>>;
    await expect.poll(() => store.load().cards.length).toBe(1);
    expect(refreshed).toEqual([1]);
    const card = store.load().cards[0];
    const response = await participant.swipeCard({ operationId: "8a0a0000-0000-4000-8000-000000000102", expectedVersion: 1, cardRef: card.ref, gesture: "me", dwell: "fast", flipped: false });
    expect(response.ok).toBe(true);

    await expect(pending).resolves.toMatchObject({ ok: true, outcome: "completed", data: { probeRef: card.ref, response: { gesture: "me" } }, stageReceipt: { command: "deal_cards", beforeVersion: 0, afterVersion: 1 }, responseReceipt: { command: "swipe_card", beforeVersion: 1, afterVersion: 2 }, stateVersion: 2 });
  });

  it("replays a completed operation without duplicating the probe", async () => {
    const { store, participant, agent } = setup();
    const controller = new AbortController();
    const tool = createRunProbeTool(agent, controller.signal, { loadWorkspace: () => store.load() });
    const first = tool.execute(INPUT) as Promise<Record<string, unknown>>;
    await expect.poll(() => store.load().cards.length).toBe(1);
    await participant.swipeCard({ operationId: "8a0a0000-0000-4000-8000-000000000103", expectedVersion: 1, cardRef: store.load().cards[0].ref, gesture: "wish", dwell: "medium", flipped: false });
    const completed = await first;
    const replay = await tool.execute(INPUT);

    expect(replay).toMatchObject({ ok: true, outcome: "replay", stageReceipt: completed.stageReceipt, responseReceipt: completed.responseReceipt, stateVersion: 2 });
    expect(store.load().cards).toHaveLength(1);
    expect(store.load().swipes).toHaveLength(1);
  });

  it("preserves a staged probe across abort, timeout, and reload recovery", async () => {
      const { store, participant, agent } = setup();
      const firstController = new AbortController();
      const firstTool = createRunProbeTool(agent, firstController.signal, { loadWorkspace: () => store.load() });
      const aborted = firstTool.execute(INPUT) as Promise<Record<string, unknown>>;
      await expect.poll(() => store.load().cards.length).toBe(1);
      firstController.abort();
      await expect(aborted).resolves.toMatchObject({ ok: false, outcome: "aborted", data: { status: "awaiting_participant" }, recovery: { stagedProbePreserved: true } });
      expect(store.load().cards[0].status).toBe("dealt");

      const reloadController = new AbortController();
      const reloadTool = createRunProbeTool(agent, reloadController.signal, { loadWorkspace: () => store.load() });
      const timedOut = reloadTool.execute({ ...INPUT, waitMs: 1_000 }) as Promise<Record<string, unknown>>;
      await expect(timedOut).resolves.toMatchObject({ ok: false, outcome: "timeout", data: { probeRef: store.load().cards[0].ref }, stageReceipt: { operationId: INPUT.operationId } });

      await participant.swipeCard({ operationId: "8a0a0000-0000-4000-8000-000000000104", expectedVersion: 1, cardRef: store.load().cards[0].ref, gesture: "not_me", dwell: "off", flipped: false });
      await expect(reloadTool.execute(INPUT)).resolves.toMatchObject({ ok: true, outcome: "replay", data: { response: { gesture: "not_me" } }, stateVersion: 2 });
      expect(store.load().cards).toHaveLength(1);
  }, 10_000);

  it("denies a stale stage without changing state", async () => {
    const { store, agent } = setup();
    const tool = createRunProbeTool(agent, new AbortController().signal, { loadWorkspace: () => store.load() });
    const result = await tool.execute({ ...INPUT, operationId: "8a0a0000-0000-4000-8000-000000000105", expectedVersion: 7 });
    expect(result).toMatchObject({ ok: false, outcome: "denied", error: { code: "STALE_STATE" }, stateVersion: 0 });
    expect(store.load().cards).toHaveLength(0);
    expect(store.load().operations).toHaveLength(0);
  });
});
