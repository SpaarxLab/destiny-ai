import { chromium, expect, test as base, type BrowserContext, type Page } from "@playwright/test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createParticipantCommandAdapter } from "../src/adapters/participant-command-adapter";
import { CommandKernel } from "../src/commands/command-kernel";
import { createEmptyWorkspace, type Workspace } from "../src/domain/workspace";
import { MemoryWorkspaceStore } from "../src/storage/memory-workspace-store";
import { LOCAL_WORKSPACE_KEY } from "../src/storage/local-workspace-store";

/**
 * Real Google Chrome with WebMCP enabled through the persisted `enable-webmcp-testing` flag.
 * Everything below goes through `document.modelContext.getTools()` / `executeTool()` exactly as a
 * visiting agent would. Chrome returns each tool result serialized as a JSON string.
 */
const test = base.extend<{ chromeContext: BrowserContext; chromePage: Page }>({
  chromeContext: async ({}, provide) => {
    const profile = mkdtempSync(join(tmpdir(), "destiny-webmcp-"));
    mkdirSync(profile, { recursive: true });
    writeFileSync(
      join(profile, "Local State"),
      JSON.stringify({ browser: { enabled_labs_experiments: ["enable-webmcp-testing@1"] } }),
    );
    const context = await chromium.launchPersistentContext(profile, {
      channel: "chrome",
      headless: true,
      args: ["--no-first-run", "--no-default-browser-check"],
    });
    await provide(context);
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  },
  chromePage: async ({ chromeContext, baseURL }, provide) => {
    const page = await chromeContext.newPage();
    await page.goto(baseURL ?? "http://127.0.0.1:3101/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await provide(page);
  },
});


const SHAPES = [["Too many paths", "I keep returning to making complicated work easier to understand."]] as const;
const SECOND_ANSWER = "I want to learn whether this kind of work gives me steady energy.";
const THIRD_ANSWER = "A free, private test that I can stop within a week would feel safe.";

async function answerQuestion(page: Page, text: string) {
  await page.getByLabel("Your words").fill(text);
  await page.getByRole("button", { name: "Continue" }).click();
}

function routeCard(page: Page, kind: "closest" | "bridge" | "probe") {
  return page.locator(`article.route-card--${kind}`);
}

async function readWorkspace(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), LOCAL_WORKSPACE_KEY);
}

function agentRoutes(
  first: { ref: string; text: string },
  answer: { ref: string; text: string },
  caps: { hoursPerWeek: number; money: number; currency: string },
  suffix: string,
) {
  const quote = (word: { ref: string; text: string }) => ({ reflectionRef: word.ref, quote: word.text });
  const common = { constraint: `Within ${caps.hoursPerWeek} hours and ${caps.money} ${caps.currency}, reversible in a week.` };
  return [
    {
      ref: `route-closest-${suffix}`, kind: "closest", title: "Explain one messy system", premise: "Work that makes complicated things clear may already be the closest direction.",
      sourceQuotes: [quote(first)], ...common, learningQuestion: "Does explaining one real system give energy?",
      test: { action: "Explain one workflow to a peer in writing.", maximumDays: 3, maximumHours: 1, maximumMoney: 0, currency: caps.currency },
      strengthensWhen: "You want to do it again.", weakensWhen: "It drains you.",
    },
    {
      ref: `route-bridge-${suffix}`, kind: "bridge", title: "Handover writing for teams", premise: "Calm handovers may bridge clarity work with team support.",
      sourceQuotes: [quote(answer)], ...common, learningQuestion: "Does one written handover help a real person start calmly?",
      test: { action: "Write one handover note for a colleague.", maximumDays: 5, maximumHours: 2, maximumMoney: 0, currency: caps.currency },
      strengthensWhen: "They use it.", weakensWhen: "It goes unread.",
    },
    {
      ref: `route-probe-${suffix}`, kind: "probe", title: "Teach clarity in public", premise: "A small public teaching artefact may probe a more distant direction.",
      sourceQuotes: [quote(first)], ...common, learningQuestion: "Does sharing one explanation attract useful feedback?",
      test: { action: "Publish one short explainer privately to three people.", maximumDays: 7, maximumHours: 3, maximumMoney: 0, currency: caps.currency },
      strengthensWhen: "Feedback arrives.", weakensWhen: "Silence.",
    },
  ];
}

type ToolResult = { ok: boolean; data?: Record<string, unknown>; error?: { code: string }; stateVersion: number; guidance: string; receipt?: Record<string, unknown> };

async function listTools(page: Page): Promise<string[]> {
  return page.evaluate(async () => (await (document as ModelContextDocument).modelContext.getTools()).map((tool) => tool.name));
}

async function executeTool(page: Page, name: string, input: unknown): Promise<ToolResult> {
  const raw = await page.evaluate(async ([toolName, json]) => {
    const context = (document as ModelContextDocument).modelContext;
    const tools = await context.getTools();
    const tool = tools.find((candidate) => candidate.name === toolName);
    if (!tool) throw new Error(`Tool ${toolName} is not registered on this page.`);
    return context.executeTool(tool, json);
  }, [name, JSON.stringify(input)] as const);
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as ToolResult;
}

async function waitForTool(page: Page, name: string, present = true) {
  await expect.poll(async () => (await listTools(page)).includes(name), { timeout: 15_000 }).toBe(present);
}

async function seedWorkspace(page: Page, workspace: Workspace) {
  await page.evaluate(([key, json]) => localStorage.setItem(key, json), [LOCAL_WORKSPACE_KEY, JSON.stringify(workspace)] as const);
  await page.reload();
  await page.waitForSelector('[data-webmcp-status="registered"]');
}

/** A workspace exactly as the participant journey produces it: limits, then three confirmed answers. */
async function confirmedWordsWorkspace(): Promise<Workspace> {
  const store = new MemoryWorkspaceStore(createEmptyWorkspace());
  const participant = createParticipantCommandAdapter(new CommandKernel(store));
  const ids = ["00000000-0000-4000-8000-00000000a001", "00000000-0000-4000-8000-00000000a002", "00000000-0000-4000-8000-00000000a003", "00000000-0000-4000-8000-00000000a004"];
  const limits = await participant.setLimits({ operationId: ids[0], expectedVersion: 0, costCaps: { hoursPerWeek: 3, money: 500, currency: "INR" } });
  if (!limits.ok) throw new Error(`fixture: ${limits.error?.what}`);
  const words = [
    "I keep returning to making complicated work easier to understand.",
    "I want to learn whether this kind of work gives me steady energy.",
    "A free, private test that I can stop within a week would feel safe.",
  ];
  for (const [index, text] of words.entries()) {
    const result = await participant.saveReflection({ operationId: ids[index + 1], expectedVersion: index + 1, text });
    if (!result.ok) throw new Error(`fixture: ${result.error?.what}`);
  }
  return store.load();
}

function routesFrom(orientation: Record<string, unknown>, suffix: string) {
  const words = orientation.confirmedWords as { ref: string; text: string }[];
  const caps = (orientation.focus as { costCaps: { hoursPerWeek: number; money: number; currency: string } }).costCaps;
  const quote = (index: number, from: number, to: number) => ({ reflectionRef: words[index].ref, quote: words[index].text.slice(from, to) });
  const common = { constraint: `Stay inside ${caps.hoursPerWeek} hours and ${caps.money} ${caps.currency}.`, strengthensWhen: "The work asks to be repeated.", weakensWhen: "The work feels like a chore." };
  return [
    { ...common, ref: `route-closest-${suffix}`, kind: "closest", title: "Explain one real system", premise: "Explaining complicated work may already be the direction.", sourceQuotes: [quote(0, 20, 56)], learningQuestion: "Does explaining one system create energy?", test: { action: "Explain one workflow to a colleague.", maximumDays: 3, maximumHours: 1, maximumMoney: 0, currency: caps.currency } },
    { ...common, ref: `route-bridge-${suffix}`, kind: "bridge", title: "Pair clarity with a new problem", premise: "Combining clarity work with an unfamiliar problem may reveal a bridge.", sourceQuotes: [quote(1, 0, 30)], learningQuestion: "Does an unfamiliar problem still feel worth clarifying?", test: { action: "Sketch one explanation of a problem outside your field.", maximumDays: 5, maximumHours: 2, maximumMoney: 0, currency: caps.currency } },
    { ...common, ref: `route-probe-${suffix}`, kind: "probe", title: "Teach one tiny lesson", premise: "A small teaching probe may test whether explaining to strangers matters.", sourceQuotes: [quote(2, 0, 20)], learningQuestion: "Does a stranger's question feel energising?", test: { action: "Record a two-minute explanation and share it privately.", maximumDays: 7, maximumHours: 3, maximumMoney: 0, currency: caps.currency } },
  ];
}

test.describe("live WebMCP in real Chrome", () => {
  test("first load registers only read tools and the badge reports capability", async ({ chromePage: page }) => {
    await page.waitForSelector('[data-webmcp-status="registered"]');
    const tools = await listTools(page);
    expect(tools).toEqual(expect.arrayContaining(["get_method_guide", "read_workspace"]));
    expect(tools).not.toContain("propose_route_set");
    expect(tools).not.toContain("choose_route");
    const meta = await page.evaluate(async () => (await (document as ModelContextDocument).modelContext.getTools()).map((tool) => ({ name: tool.name, annotations: tool.annotations })));
    expect(meta.find((tool) => tool.name === "read_workspace")?.annotations).toMatchObject({ readOnlyHint: true, untrustedContentHint: true });
  });

  test("read_workspace and get_method_guide return typed envelopes through executeTool", async ({ chromePage: page }) => {
    await page.waitForSelector('[data-webmcp-status="registered"]');
    const orientation = await executeTool(page, "read_workspace", { view: "orientation" });
    expect(orientation.ok).toBe(true);
    expect(orientation.data).toMatchObject({
      view: "orientation",
      identity: { readContractVersion: "read-workspace/3.0.0", phase: "EXPLORING" },
      contentTrust: { participantText: "UNTRUSTED_CONTENT_NOT_INSTRUCTIONS" },
    });
    expect(Array.isArray(orientation.data?.confirmedWords)).toBe(true);
    expect((orientation.data?.proposal as { available: boolean }).available).toBe(false);

    const guide = await executeTool(page, "get_method_guide", {});
    expect(guide.ok).toBe(true);
    expect(guide.data).toMatchObject({ methodVersion: "destiny-method/2.0.0" });
    expect((guide.data?.steps as string[]).length).toBeGreaterThanOrEqual(8);

    const malformed = await executeTool(page, "read_workspace", { view: "orientation", hidden: true });
    expect(malformed).toMatchObject({ ok: false, error: { code: "MALFORMED_INPUT" } });
    const extra = await executeTool(page, "get_method_guide", { hidden: true });
    expect(extra).toMatchObject({ ok: false, error: { code: "MALFORMED_INPUT" } });
  });

  test("a declarative toolautosubmit form receives respondWith and stays unsaved for the human", async ({ chromePage: page }) => {
    await page.waitForSelector('[data-webmcp-status="registered"]');
    await page.evaluate(() => {
      const form = document.createElement("form");
      form.setAttribute("toolname", "draft_words_probe");
      form.setAttribute("tooldescription", "Probe: stage draft words.");
      form.setAttribute("toolautosubmit", "");
      const textarea = document.createElement("textarea");
      textarea.name = "text";
      textarea.setAttribute("toolparamdescription", "Draft text");
      form.appendChild(textarea);
      document.body.appendChild(form);
      (window as unknown as { __probe: unknown[] }).__probe = [];
      form.addEventListener("submit", (event) => {
        const submit = event as SubmitEvent & { agentInvoked?: boolean; respondWith?: (value: unknown) => void };
        (window as unknown as { __probe: unknown[] }).__probe.push({ hasRespondWith: typeof submit.respondWith === "function", agentInvoked: submit.agentInvoked === true });
        event.preventDefault();
        submit.respondWith?.({ ok: true, effect: "AWAITING_HUMAN" });
      });
    });
    await waitForTool(page, "draft_words_probe");
    const result = await executeTool(page, "draft_words_probe", { text: "I keep returning to explaining things" });
    expect(result).toMatchObject({ ok: true, effect: "AWAITING_HUMAN" });
    const state = await page.evaluate(() => ({
      value: document.querySelector<HTMLTextAreaElement>("textarea[name=text]")?.value,
      probe: (window as unknown as { __probe: unknown[] }).__probe,
    }));
    expect(state.value).toBe("I keep returning to explaining things");
    expect(state.probe).toEqual([{ hasRespondWith: true, agentInvoked: true }]);
  });

  test("propose, replay, deny, and reread through real Chrome from a journey-shaped workspace", async ({ chromePage: page }) => {
    await page.waitForSelector("[data-webmcp-status]");
    await seedWorkspace(page, await confirmedWordsWorkspace());
    await waitForTool(page, "propose_route_set");

    const orientation = await executeTool(page, "read_workspace", { view: "orientation" });
    expect(orientation.ok).toBe(true);
    expect((orientation.data?.proposal as { available: boolean; mode: string })).toMatchObject({ available: true, mode: "fresh" });
    expect((orientation.data?.confirmedWords as unknown[]).length).toBe(3);

    const operationId = "00000000-0000-4000-8000-00000000b001";
    const proposal = await executeTool(page, "propose_route_set", {
      operationId, expectedVersion: orientation.stateVersion, outcome: "routes", routes: routesFrom(orientation.data!, "live"),
    });
    expect(proposal).toMatchObject({ ok: true, data: { outcome: "routes", routeSet: { createdBy: "chatgpt_webmcp", status: "proposed" } }, receipt: { effect: "PROPOSED", command: "propose_route_set" } });
    expect(proposal.stateVersion).toBe(orientation.stateVersion + 1);

    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), LOCAL_WORKSPACE_KEY);
    expect(stored.routeProposalSets).toHaveLength(1);
    expect(stored.routeProposalSets[0].createdBy).toBe("chatgpt_webmcp");
    expect(stored.operations.at(-1)).toMatchObject({ operationId, command: "propose_route_set", effect: "PROPOSED" });

    await waitForTool(page, "propose_route_set");
    const replay = await executeTool(page, "propose_route_set", {
      operationId, expectedVersion: orientation.stateVersion, outcome: "routes", routes: routesFrom(orientation.data!, "live"),
    });
    expect(replay.ok).toBe(true);
    expect(replay.guidance).toContain("Replay detected");
    expect(replay.receipt).toEqual(proposal.receipt);

    const denied = await executeTool(page, "propose_route_set", {
      operationId: "00000000-0000-4000-8000-00000000b002", expectedVersion: proposal.stateVersion, outcome: "routes",
      routes: routesFrom(orientation.data!, "again"), supersedesRouteSetRef: (proposal.data!.routeSet as { ref: string }).ref,
    });
    expect(denied).toMatchObject({ ok: false, error: { code: "POLICY_DENIED" } });

    const reread = await executeTool(page, "read_workspace", { view: "orientation" });
    expect(reread.data).toMatchObject({
      active: { routeSet: { status: "proposed", createdBy: "chatgpt_webmcp" } },
      nextHumanDecision: { kind: "CHOOSE_OR_REVISE_ROUTE_SET" },
      proposal: { available: false },
      latestChange: { command: "propose_route_set", effect: "PROPOSED", actor: "agent" },
    });
    const afterStored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), LOCAL_WORKSPACE_KEY);
    expect(afterStored.operations).toHaveLength(stored.operations.length);
  });

  test("asks one question before proposing, and the follow-up is receipted and visible to a reread", async ({ chromePage: page }) => {
    await page.waitForSelector("[data-webmcp-status]");
    await seedWorkspace(page, await confirmedWordsWorkspace());
    await waitForTool(page, "propose_route_set");
    const orientation = await executeTool(page, "read_workspace", { view: "orientation" });
    const words = orientation.data!.confirmedWords as { ref: string }[];
    const asked = await executeTool(page, "propose_route_set", {
      operationId: "00000000-0000-4000-8000-00000000b011", expectedVersion: orientation.stateVersion,
      outcome: "insufficient_signal", followUpQuestion: "Which recent task felt worth repeating, and why?", reasonRefs: [words[0].ref],
    });
    expect(asked).toMatchObject({ ok: true, data: { outcome: "insufficient_signal", followUp: { status: "proposed", askedBy: "chatgpt_webmcp" } }, receipt: { effect: "PROPOSED" } });
    const reread = await executeTool(page, "read_workspace", { view: "orientation" });
    expect(reread.data).toMatchObject({
      active: { followUp: { status: "proposed" } },
      nextHumanDecision: { kind: "ANSWER_FOLLOW_UP" },
    });
  });

  test("full human-agent story through the rendered Route Room in real Chrome", async ({ chromePage: page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));

    // 0. Before any words are confirmed only the read tools exist.
    await page.waitForSelector('[data-webmcp-status="registered"]');
    expect(await listTools(page)).toEqual(expect.arrayContaining(["read_workspace", "get_method_guide"]));
    expect(await listTools(page)).not.toContain("propose_route_set");

    // 1. The declarative draft form on a question screen: the agent fills, the human confirms.
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.getByLabel(SHAPES[0][0]).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await waitForTool(page, "draft_words");
    const drafted = await executeTool(page, "draft_words", { text: SHAPES[0][1] });
    expect(drafted).toMatchObject({ ok: true, effect: "AWAITING_HUMAN" });
    await expect(page.getByText("ChatGPT drafted these words. Edit or confirm them.")).toBeVisible();
    await expect(page.getByLabel("Your words")).toHaveValue(SHAPES[0][1]);
    expect((await readWorkspace(page))?.operations ?? []).toEqual([]);
    await page.getByRole("button", { name: "Continue" }).click();
    await answerQuestion(page, SECOND_ANSWER);
    await answerQuestion(page, THIRD_ANSWER);
    await expect(page.getByRole("heading", { level: 1, name: "Do these still sound like you?" })).toBeVisible();
    await page.getByRole("button", { name: "Use these words" }).click();
    await page.getByLabel("Time each week").fill("3");
    await page.getByLabel("Most you would spend on one test").fill("500");
    await page.getByLabel("Currency").fill("INR");
    await page.getByRole("button", { name: "Save my words and limits" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Now three routes can be proposed." })).toBeVisible();

    // 2. After the handoff the write tool appears and the room says so.
    await waitForTool(page, "propose_route_set");
    await expect(page.getByTestId("capability-line")).toContainText("propose three routes");
    const orientation = await executeTool(page, "read_workspace", { view: "orientation" });
    expect(orientation.ok).toBe(true);
    const words = orientation.data!.confirmedWords as { ref: string; text: string }[];
    const caps = (orientation.data!.focus as { costCaps: { hoursPerWeek: number; money: number; currency: string } }).costCaps;
    expect(words.map((word) => word.text)).toContain(SHAPES[0][1]);
    expect(caps).toEqual({ hoursPerWeek: 3, money: 500, currency: "INR" });

    // 3. The agent asks one question first; the human answers in the room.
    const asked = await executeTool(page, "propose_route_set", {
      operationId: "00000000-0000-4000-8000-00000000c001",
      expectedVersion: orientation.stateVersion,
      outcome: "insufficient_signal",
      followUpQuestion: "Which recent task felt absorbing enough to repeat?",
      reasonRefs: [words[0].ref],
    });
    expect(asked).toMatchObject({ ok: true, data: { outcome: "insufficient_signal" }, receipt: { effect: "PROPOSED" } });
    await expect(page.getByRole("heading", { level: 1, name: "One question first" })).toBeVisible();
    await expect(page.getByText("Which recent task felt absorbing enough to repeat?")).toBeVisible();
    await page.getByLabel("Your answer, in your words").fill("Untangling a messy handover so the next person could start calmly.");
    await page.getByRole("button", { name: "Answer", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Now three routes can be proposed." })).toBeVisible();

    // 4. Three routes quoting the confirmed words, including the answer.
    await waitForTool(page, "propose_route_set");
    const afterAnswer = await executeTool(page, "read_workspace", { view: "orientation" });
    const answerWord = (afterAnswer.data!.confirmedWords as { ref: string; text: string }[]).find((word) => word.text.includes("messy handover"))!;
    expect(answerWord).toBeTruthy();
    const proposed = await executeTool(page, "propose_route_set", {
      operationId: "00000000-0000-4000-8000-00000000c002",
      expectedVersion: afterAnswer.stateVersion,
      outcome: "routes",
      routes: agentRoutes(words[0], answerWord, caps, "a"),
    });
    expect(proposed).toMatchObject({ ok: true, data: { outcome: "routes", routeSet: { createdBy: "chatgpt_webmcp" } }, receipt: { effect: "PROPOSED" } });
    await expect(page.getByRole("heading", { level: 1, name: "Three directions. You pick the one to test." })).toBeVisible();
    await expect(page.getByTestId("provenance")).toHaveText("Proposed by ChatGPT");
    await expect(page.locator(".status-region--room")).toContainText("ChatGPT proposed three routes");
    await page.getByRole("button", { name: "What happened" }).click();
    const drawer = page.getByRole("dialog", { name: "Every change, in order" });
    await expect(drawer.getByText("ChatGPT proposed three routes")).toBeVisible();
    await expect(drawer.getByText("ChatGPT asked one question before proposing")).toBeVisible();
    await expect(drawer.getByText("You answered the question")).toBeVisible();
    await expect(drawer.getByText(/receipt \d+ · version \d+ to \d+/).first()).toBeVisible();
    await drawer.getByRole("button", { name: "Close" }).click();

    // 5. A proposal that changes a kept route is denied and the human sees it.
    await waitForTool(page, "propose_route_set");
    const denied = await executeTool(page, "propose_route_set", {
      operationId: "00000000-0000-4000-8000-00000000c003",
      expectedVersion: proposed.stateVersion,
      outcome: "routes",
      routes: agentRoutes(words[0], answerWord, caps, "b"),
      supersedesRouteSetRef: (proposed.data!.routeSet as { ref: string }).ref,
    });
    expect(denied).toMatchObject({ ok: false, error: { code: "POLICY_DENIED" } });
    await expect(page.locator(".notice--warning")).toContainText("Nothing changed");
    expect(((await readWorkspace(page)).operations as unknown[]).length).toBe(proposed.stateVersion);

    // 6. The human sets Probe aside; the agent may replace only Probe and must carry the rest.
    const probe = routeCard(page, "probe");
    await probe.getByRole("button", { name: "Set aside" }).click();
    await probe.getByRole("button", { name: "Set aside", exact: true }).last().click();
    await expect(page.locator(".room__state")).toContainText(/replace/);
    await waitForTool(page, "propose_route_set");
    const current = await executeTool(page, "read_workspace", { view: "orientation" });
    const proposal = current.data!.proposal as { mode: string; carryRouteRefs: string[]; supersedesRouteSetRef: string; replaceKinds: string[] };
    expect(proposal).toMatchObject({ mode: "replace_rejected", replaceKinds: ["probe"] });
    const keptRefs = proposal.carryRouteRefs;
    const wrong = await executeTool(page, "propose_route_set", {
      operationId: "00000000-0000-4000-8000-00000000c004",
      expectedVersion: current.stateVersion,
      outcome: "routes",
      routes: [agentRoutes(words[0], answerWord, caps, "w")[0], { carryRouteRef: keptRefs[1] }, agentRoutes(words[0], answerWord, caps, "w")[2]],
      supersedesRouteSetRef: proposal.supersedesRouteSetRef,
    });
    expect(wrong).toMatchObject({ ok: false, error: { code: "POLICY_DENIED" } });
    await expect(page.locator(".notice--warning")).toContainText("tried to change a route you kept");
    const replaced = await executeTool(page, "propose_route_set", {
      operationId: "00000000-0000-4000-8000-00000000c005",
      expectedVersion: current.stateVersion,
      outcome: "routes",
      routes: [{ carryRouteRef: keptRefs[0] }, { carryRouteRef: keptRefs[1] }, agentRoutes(words[0], answerWord, caps, "c")[2]],
      supersedesRouteSetRef: proposal.supersedesRouteSetRef,
    });
    expect(replaced).toMatchObject({ ok: true, data: { outcome: "routes" } });
    await expect(page.getByText("Replaced by ChatGPT")).toBeVisible();
    await expect(page.getByText("Kept from your last set").first()).toBeVisible();
    await expect(page.locator(".status-region--room")).toContainText("replaced the route you set aside");

    // 7. The human chooses; the agent reads the decision back and loses the write tool.
    await routeCard(page, "closest").getByRole("button", { name: "Choose this to test" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /You chose “/ })).toBeVisible();
    await expect(page.getByTestId("receipt-line")).toContainText("receipt");
    await waitForTool(page, "propose_route_set", false);
    const reread = await executeTool(page, "read_workspace", { view: "orientation" });
    expect(reread.data).toMatchObject({
      identity: { phase: "TESTING" },
      active: { hypothesis: { status: "accepted" } },
      latestChange: { command: "choose_route", actor: "participant" },
      proposal: { available: false },
    });
    expect(await listTools(page)).toEqual(expect.arrayContaining(["read_workspace", "get_method_guide"]));
    expect(errors).toEqual([]);
  });
});

type ModelContextDocument = Document & {
  modelContext: {
    getTools(): Promise<Array<{ name: string; description: string; inputSchema: unknown; annotations?: Record<string, unknown> }>>;
    executeTool(tool: unknown, input: string): Promise<unknown>;
  };
};
