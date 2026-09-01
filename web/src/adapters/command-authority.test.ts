import { describe, expect, it } from "vitest";
import { CommandKernel } from "../commands/command-kernel";
import { p3Workspace, validRoutes } from "../commands/fixtures/p3-route-set";
import { MemoryWorkspaceStore } from "../storage/memory-workspace-store";
import { createParticipantCommandAdapter } from "./participant-command-adapter";
import { createWebMcpCommandAdapter } from "./webmcp-command-adapter";

const operationOne = "00000000-0000-4000-8000-000000000701";

describe("trusted command adapters", () => {
  it("exposes participant decisions only on the participant adapter", () => {
    const kernel = new CommandKernel(new MemoryWorkspaceStore(p3Workspace()));
    const participant = createParticipantCommandAdapter(kernel);
    const webmcp = createWebMcpCommandAdapter(kernel);

    expect(participant).toHaveProperty("reviseRouteSet");
    expect(participant).toHaveProperty("chooseRoute");
    expect(webmcp).not.toHaveProperty("reviseRouteSet");
    expect(webmcp).not.toHaveProperty("chooseRoute");
  });

  it("binds WebMCP provenance and rejects actor fields in tool-shaped input", async () => {
    const store = new MemoryWorkspaceStore(p3Workspace());
    const adapter = createWebMcpCommandAdapter(new CommandKernel(store));
    const malformed = await adapter.proposeRouteSet({
      operationId: operationOne,
      expectedVersion: 0,
      outcome: "routes",
      routes: validRoutes(),
      actor: "participant",
    } as never);
    expect(malformed.error?.code).toBe("MALFORMED_INPUT");
    expect(store.load().stateVersion).toBe(0);

    const result = await adapter.proposeRouteSet({
      operationId: operationOne,
      expectedVersion: 0,
      outcome: "routes",
      routes: validRoutes(),
    });
    expect(result.ok).toBe(true);
    expect(store.load().routeProposalSets[0].createdBy).toBe("chatgpt_webmcp");
  });
});
