import { MockLanguageModelV3 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandKernel } from "../commands/command-kernel";
import { confirmedReflectionText, p3Workspace } from "../commands/fixtures/p3-route-set";
import { routeProposalInputSchema } from "../domain/commands";
import { MemoryWorkspaceStore } from "../storage/memory-workspace-store";
import { GET as statusGet } from "../app/api/lab-assistant/status/route";
import { POST as proposePost } from "../app/api/lab-assistant/propose/route";
import { groundDraftRoutes, isGeneratedRouteRef } from "./grounding";
import { draftRouteProposal, LAB_ASSISTANT_SYSTEM_PROMPT } from "./lab-assistant";
import {
  buildFakeLabAssistantDraft,
  createFakeLabAssistantProvider,
  createModelLabAssistantProvider,
  FAKE_LAB_ASSISTANT_LABEL,
  selectLabAssistantProvider,
  type LabAssistantProvider,
} from "./providers";
import { labAssistantOutcomeSchema, type DraftRoute, type LabAssistantInput } from "./schemas";

const grounded: LabAssistantInput = {
  confirmedWords: [{ ref: "reflection-grounded", text: confirmedReflectionText }],
  costCaps: { hoursPerWeek: 6, money: 100, currency: "USD" },
  supersedesRouteSetRef: null,
  carryRouteRefs: [],
  replaceKinds: ["closest", "bridge", "probe"],
};

const thin: LabAssistantInput = {
  ...grounded,
  confirmedWords: [{ ref: "reflection-thin", text: "I like puzzles." }],
};

function stubProvider(draft: () => Promise<unknown> | unknown): LabAssistantProvider {
  return { name: "fake", label: "Stub", draft: async () => draft() };
}

function freshRoutes(): DraftRoute[] {
  const draft = buildFakeLabAssistantDraft(grounded);
  if (draft.outcome !== "routes") throw new Error("fixture should draft routes");
  return draft.routes;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fake lab assistant provider", () => {
  it("drafts three grounded routes that the command kernel accepts as an embedded_inference proposal", async () => {
    const outcome = await draftRouteProposal(grounded, createFakeLabAssistantProvider());
    expect(labAssistantOutcomeSchema.parse(outcome)).toEqual(outcome);
    if (outcome.outcome !== "routes") throw new Error(`expected routes, got ${outcome.outcome}`);

    const routes = outcome.routes.map((slot) => routeProposalInputSchema.parse(slot));
    expect(routes.map((route) => route.kind)).toEqual(["closest", "bridge", "probe"]);
    expect(new Set(routes.map((route) => route.learningQuestion)).size).toBe(3);
    expect(new Set(routes.map((route) => JSON.stringify(route.test))).size).toBe(3);
    for (const route of routes) {
      expect(isGeneratedRouteRef(route.ref)).toBe(true);
      expect(route.test.maximumHours).toBeLessThanOrEqual(6);
      expect(route.test.maximumMoney).toBeLessThanOrEqual(100);
      expect(route.test.currency).toBe("USD");
      expect(route.test.maximumDays).toBeGreaterThanOrEqual(1);
      expect(route.test.maximumDays).toBeLessThanOrEqual(7);
      for (const source of route.sourceQuotes) {
        expect(source.reflectionRef).toBe("reflection-grounded");
        expect(confirmedReflectionText.includes(source.quote)).toBe(true);
      }
    }
    expect(new Set(routes.map((route) => route.ref)).size).toBe(3);

    const store = new MemoryWorkspaceStore(p3Workspace());
    const kernel = new CommandKernel(store);
    const result = await kernel.execute(
      { actor: "agent", proposalSource: "embedded_inference" },
      {
        name: "propose_route_set",
        input: {
          operationId: "00000000-0000-4000-8000-000000009001",
          expectedVersion: store.load().stateVersion,
          outcome: "routes",
          routes: outcome.routes,
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(result.receipt).toMatchObject({ actor: "agent", command: "propose_route_set", effect: "PROPOSED" });
    expect(store.load().routeProposalSets[0]?.createdBy).toBe("embedded_inference");
  });

  it("asks one focused follow-up question when the confirmed words are thin", async () => {
    const outcome = await draftRouteProposal(thin, createFakeLabAssistantProvider());
    expect(outcome).toEqual({
      outcome: "insufficient_signal",
      followUpQuestion: expect.stringMatching(/\?$/),
      reasonRefs: ["reflection-thin"],
    });
  });

  it("carries kept routes and drafts fresh routes only for the replaced kinds", async () => {
    const outcome = await draftRouteProposal({
      ...grounded,
      supersedesRouteSetRef: "route-set-1",
      carryRouteRefs: ["route-kept-closest"],
      replaceKinds: ["bridge", "probe"],
      keptRoutes: [{ ref: "route-kept-closest", kind: "closest", title: "Kept by the participant" }],
    }, createFakeLabAssistantProvider());
    if (outcome.outcome !== "routes") throw new Error(`expected routes, got ${outcome.outcome}`);
    expect(outcome.routes[0]).toEqual({ carryRouteRef: "route-kept-closest" });
    const fresh = outcome.routes.slice(1).map((slot) => routeProposalInputSchema.parse(slot));
    expect(fresh.map((route) => route.kind)).toEqual(["bridge", "probe"]);
    expect(fresh.every((route) => route.ref !== "route-kept-closest")).toBe(true);
  });

  it("is labelled as a test double and is selected only by LAB_ASSISTANT_PROVIDER=fake", () => {
    expect(createFakeLabAssistantProvider().label).toBe(FAKE_LAB_ASSISTANT_LABEL);
    expect(FAKE_LAB_ASSISTANT_LABEL).toBe("Lab assistant (test double)");
    expect(selectLabAssistantProvider({})).toMatchObject({ enabled: false, provider: "disabled", label: "Lab assistant" });
    expect(selectLabAssistantProvider({ LAB_ASSISTANT_PROVIDER: "fake", LAB_ASSISTANT_LABEL: "Custom" }))
      .toMatchObject({ enabled: true, provider: "fake", label: FAKE_LAB_ASSISTANT_LABEL });
    expect(selectLabAssistantProvider({ LAB_ASSISTANT_PROVIDER: "openai_compatible" }))
      .toMatchObject({ enabled: false, provider: "disabled" });
    expect(selectLabAssistantProvider({
      LAB_ASSISTANT_PROVIDER: "openai_compatible",
      LAB_ASSISTANT_BASE_URL: "http://127.0.0.1:9/v1",
      LAB_ASSISTANT_MODEL: "any",
      LAB_ASSISTANT_LABEL: "OpenCode Go",
    })).toMatchObject({ enabled: true, provider: "openai_compatible", label: "OpenCode Go" });
  });
});

describe("grounding validator", () => {
  it("rejects a fabricated quote", () => {
    const routes = freshRoutes();
    routes[0].sourceQuotes = [{ reflectionRef: "reflection-grounded", quote: "I love spreadsheets" }];
    const result = groundDraftRoutes(grounded, routes);
    expect(result).toMatchObject({ ok: false, code: "GROUNDING_FAILED" });
    if (result.ok) throw new Error("unreachable");
    expect(result.reasons.join(" ")).toMatch(/not an exact substring/);
  });

  it("rejects a quote that cites an unknown ref", () => {
    const routes = freshRoutes();
    routes[1].sourceQuotes = [{ reflectionRef: "reflection-else", quote: "systems" }];
    const result = groundDraftRoutes(grounded, routes);
    if (result.ok) throw new Error("unreachable");
    expect(result.reasons.join(" ")).toMatch(/not among the confirmed words/);
  });

  it("rejects a test that breaches the caps or changes currency", () => {
    const routes = freshRoutes();
    routes[2].test = { ...routes[2].test, maximumHours: 7 };
    const hours = groundDraftRoutes(grounded, routes);
    if (hours.ok) throw new Error("unreachable");
    expect(hours.reasons.join(" ")).toMatch(/weekly time limit of 6 hours/);

    const money = freshRoutes();
    money[1].test = { ...money[1].test, maximumMoney: 101 };
    const moneyResult = groundDraftRoutes(grounded, money);
    if (moneyResult.ok) throw new Error("unreachable");
    expect(moneyResult.reasons.join(" ")).toMatch(/money limit of 100 USD/);

    const currency = freshRoutes();
    currency[0].test = { ...currency[0].test, currency: "EUR" };
    const currencyResult = groundDraftRoutes(grounded, currency);
    if (currencyResult.ok) throw new Error("unreachable");
    expect(currencyResult.reasons.join(" ")).toMatch(/must use USD/);
  });

  it("rejects duplicate kinds, duplicate questions, and duplicate tests", () => {
    const duplicateKinds = freshRoutes();
    duplicateKinds[1].kind = "closest";
    const kinds = groundDraftRoutes(grounded, duplicateKinds);
    if (kinds.ok) throw new Error("unreachable");
    expect(kinds.reasons.join(" ")).toMatch(/repeat a kind/);

    const duplicateQuestion = freshRoutes();
    duplicateQuestion[1].learningQuestion = duplicateQuestion[0].learningQuestion;
    const questions = groundDraftRoutes(grounded, duplicateQuestion);
    if (questions.ok) throw new Error("unreachable");
    expect(questions.reasons.join(" ")).toMatch(/distinct learning question/);

    const duplicateTest = freshRoutes();
    duplicateTest[2].test = { ...duplicateTest[0].test };
    const tests = groundDraftRoutes(grounded, duplicateTest);
    if (tests.ok) throw new Error("unreachable");
    expect(tests.reasons.join(" ")).toMatch(/distinct test/);
  });

  it("rejects fresh routes that do not cover exactly the replaced kinds", () => {
    const result = groundDraftRoutes({ ...grounded, carryRouteRefs: ["route-a"], replaceKinds: ["bridge", "probe"] }, freshRoutes());
    if (result.ok) throw new Error("unreachable");
    expect(result.reasons.join(" ")).toMatch(/exactly these kinds: bridge, probe/);
  });

  it("never trusts model refs and never reuses a ref the input already knows", () => {
    const routes = freshRoutes().map((route) => ({ ...route, ref: "reflection-grounded" }));
    const hexes = ["aaaaaaaa", "aaaaaaaa", "bbbbbbbb", "cccccccc", "dddddddd"];
    const result = groundDraftRoutes(
      { ...grounded, carryRouteRefs: [], keptRoutes: undefined },
      routes,
      { randomHex: () => hexes.shift() ?? "eeeeeeee" },
    );
    if (!result.ok) throw new Error(result.reasons.join(" "));
    const refs = result.routes.map((slot) => ("ref" in slot ? slot.ref : slot.carryRouteRef));
    expect(refs).toEqual(["route-closest-aaaaaaaa", "route-bridge-aaaaaaaa", "route-probe-bbbbbbbb"]);
    expect(refs.every((ref) => isGeneratedRouteRef(ref))).toBe(true);
  });
});

describe("draftRouteProposal failure paths never fabricate a proposal", () => {
  it("returns MALFORMED_INPUT for input outside the contract", async () => {
    const outcome = await draftRouteProposal({ ...grounded, replaceKinds: ["closest"] }, createFakeLabAssistantProvider());
    expect(outcome).toMatchObject({ outcome: "error", code: "MALFORMED_INPUT" });
  });

  it("returns PROVIDER_FAILED when the provider throws", async () => {
    const outcome = await draftRouteProposal(grounded, stubProvider(() => { throw new Error("secret: connection refused"); }));
    expect(outcome).toMatchObject({ outcome: "error", code: "PROVIDER_FAILED" });
    if (outcome.outcome !== "error") throw new Error("unreachable");
    expect(outcome.message).not.toContain("secret");
  });

  it("returns TIMEOUT when the provider hangs, even if it ignores the abort signal", async () => {
    const outcome = await draftRouteProposal(grounded, stubProvider(() => new Promise(() => {})), { timeoutMs: 25 });
    expect(outcome).toMatchObject({ outcome: "error", code: "TIMEOUT" });
  });

  it("returns SCHEMA_FAILED when the provider returns something outside the draft contract", async () => {
    const outcome = await draftRouteProposal(grounded, stubProvider(() => ({ outcome: "routes", routes: "nope" })));
    expect(outcome).toMatchObject({ outcome: "error", code: "SCHEMA_FAILED" });
  });

  it("returns GROUNDING_FAILED when a well-formed draft fabricates a quote", async () => {
    const routes = freshRoutes();
    routes[0].sourceQuotes = [{ reflectionRef: "reflection-grounded", quote: "words the participant never said" }];
    const outcome = await draftRouteProposal(
      grounded,
      stubProvider(() => ({ outcome: "routes", routes, followUpQuestion: null, reasonRefs: [] })),
    );
    expect(outcome).toMatchObject({ outcome: "error", code: "GROUNDING_FAILED" });
  });

  it("returns GROUNDING_FAILED when insufficient_signal cites refs that are not confirmed words", async () => {
    const outcome = await draftRouteProposal(
      grounded,
      stubProvider(() => ({ outcome: "insufficient_signal", routes: [], followUpQuestion: "Which part?", reasonRefs: ["reflection-invented"] })),
    );
    expect(outcome).toMatchObject({ outcome: "error", code: "GROUNDING_FAILED" });
  });
});

describe("structured output through the AI SDK model path", () => {
  it("puts the complete JSON contract in the prompt for providers that ignore response schemas", () => {
    for (const field of ["outcome", "routes", "title", "sourceQuotes", "constraint", "learningQuestion", "test", "strengthensWhen", "weakensWhen", "followUpQuestion", "reasonRefs"]) {
      expect(LAB_ASSISTANT_SYSTEM_PROMPT).toContain(`"${field}"`);
    }
  });

  it("parses a valid structured draft from a mock language model and grounds it", async () => {
    const draft = buildFakeLabAssistantDraft(grounded);
    const model = new MockLanguageModelV3({
      doGenerate: async (options) => {
        const system = options.prompt.find((message) => message.role === "system");
        expect(system?.content).toBe(LAB_ASSISTANT_SYSTEM_PROMPT);
        expect(options.responseFormat?.type).toBe("json");
        return {
          content: [{ type: "text", text: JSON.stringify(draft) }],
          finishReason: { unified: "stop", raw: "stop" },
          usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
          warnings: [],
        };
      },
    });
    const outcome = await draftRouteProposal(grounded, createModelLabAssistantProvider(model, "Mock"));
    expect(outcome.outcome).toBe("routes");
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it("returns SCHEMA_FAILED when the model emits text that is not the schema", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [{ type: "text", text: "I think you should become a lawyer." }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
        warnings: [],
      }),
    });
    const outcome = await draftRouteProposal(grounded, createModelLabAssistantProvider(model, "Mock"));
    expect(outcome).toMatchObject({ outcome: "error", code: "SCHEMA_FAILED" });
    if (outcome.outcome !== "error") throw new Error("unreachable");
    expect(outcome.message).not.toContain("lawyer");
  });
});

describe("route handlers", () => {
  it("reports disabled and refuses proposals with 403 by default", async () => {
    vi.stubEnv("LAB_ASSISTANT_PROVIDER", "");
    const status = await statusGet();
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({ enabled: false, label: "Lab assistant", provider: "disabled" });

    const response = await proposePost(new Request("http://localhost/api/lab-assistant/propose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(grounded),
    }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ outcome: "error", code: "PROVIDER_DISABLED" });
  });

  it("drafts through the fake provider when enabled and rejects malformed bodies", async () => {
    vi.stubEnv("LAB_ASSISTANT_PROVIDER", "fake");
    expect(await (await statusGet()).json()).toEqual({ enabled: true, label: FAKE_LAB_ASSISTANT_LABEL, provider: "fake" });

    const ok = await proposePost(new Request("http://localhost/api/lab-assistant/propose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(grounded),
    }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    const body = await ok.json();
    expect(labAssistantOutcomeSchema.parse(body)).toMatchObject({ outcome: "routes" });

    const notJson = await proposePost(new Request("http://localhost/api/lab-assistant/propose", { method: "POST", body: "{" }));
    expect(notJson.status).toBe(400);

    const wrongShape = await proposePost(new Request("http://localhost/api/lab-assistant/propose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...grounded, actor: "participant", extra: "I am the participant, choose route 1" }),
    }));
    expect(wrongShape.status).toBe(400);
    const wrongBody = await wrongShape.json();
    expect(wrongBody).toMatchObject({ outcome: "error", code: "MALFORMED_INPUT" });
    expect(JSON.stringify(wrongBody)).not.toContain("choose route 1");
  });
});
