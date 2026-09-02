import { expect, test, type Page } from "@playwright/test";
import { createEmptyWorkspace } from "../src/domain/workspace";

const WORKSPACE_KEY = "destiny-ai.workspace.v1";

const SHAPES = [
  ["Too many paths", "I keep returning to making complicated work easier to understand."],
  ["Nothing fits", "Work felt worthwhile when I helped a teammate see a difficult problem clearly."],
  ["I need a safer next move", "My next move needs to protect my energy and financial stability."],
  ["I would rather start with my own question", "How can I find work that uses both careful thinking and clear communication?"],
] as const;

const SECOND_ANSWER = "I want to learn whether this kind of work gives me steady energy.";
const THIRD_ANSWER = "A free, private test that I can stop within a week would feel safe.";

/**
 * A faithful stand-in for Chrome's document.modelContext: registerTool(tool, { signal }) keeps
 * live registrations, and the test executes tools the way an agent would.
 */
const FAKE_MODEL_CONTEXT = `
  (() => {
    const registrations = [];
    const context = {
      async registerTool(tool, options) {
        const signal = options && options.signal;
        registrations.push({ tool, signal });
      },
      async getTools() {
        return registrations.filter((r) => !(r.signal && r.signal.aborted)).map((r) => ({ name: r.tool.name, description: r.tool.description, inputSchema: r.tool.inputSchema, annotations: r.tool.annotations }));
      },
      async executeTool(tool, input) {
        const live = registrations.filter((r) => !(r.signal && r.signal.aborted) && r.tool.name === tool.name).at(-1);
        if (!live) throw new Error("no live tool " + tool.name);
        return live.tool.execute(typeof input === "string" ? JSON.parse(input) : input, { signal: new AbortController().signal });
      },
    };
    Object.defineProperty(document, "modelContext", { value: context, configurable: true });
    window.__destinyAgent = {
      async call(name, input) {
        const tools = await context.getTools();
        const tool = tools.find((t) => t.name === name);
        if (!tool) return { missing: true, tools: tools.map((t) => t.name) };
        return context.executeTool(tool, JSON.stringify(input));
      },
      async tools() { return (await context.getTools()).map((t) => t.name); },
    };
  })();
`;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(({ key, workspace }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(workspace));
  }, { key: WORKSPACE_KEY, workspace: createEmptyWorkspace("00000000-0000-4000-8000-000000000321") });
  await page.reload();
});

for (const [shape, firstAnswer] of SHAPES) {
  test(`${shape} reaches the handoff with limits saved through the kernel`, async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await completeToHandoff(page, shape, firstAnswer, shape === SHAPES[3][0]);
    await expect(page.getByRole("heading", { level: 1, name: "Now three routes can be proposed." })).toBeVisible();
    await expect(page.locator("[data-webmcp-status=unsupported]")).toBeVisible();
    const workspace = await readWorkspace(page);
    expect(workspace.participant.costCaps).toEqual({ hoursPerWeek: 3, money: 500, currency: "INR" });
    const commands = workspace.operations.map((operation: { command: string }) => operation.command);
    expect(commands[0]).toBe("set_limits");
    expect(commands.slice(1).every((command: string) => command === "save_reflection")).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("manual drafts reach the Route Room quoting different answers, then edit, set aside, choose, reopen", async ({ page }) => {
  const errors = captureConsoleErrors(page);
  await completeToHandoff(page, SHAPES[0][0], SHAPES[0][1]);
  await page.getByRole("button", { name: "Draft my own" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Make these three drafts sound like you." })).toBeVisible();
  await page.getByRole("button", { name: "Put these in my room" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Which direction is worth testing for a week?" })).toBeVisible();
  await expect(page.getByTestId("provenance")).toHaveText("Drafted by you");
  await page.getByText("See the week and signals").all().then((summaries) => Promise.all(summaries.map((summary) => summary.click())));
  await expect(page.locator(".route-card__quote")).toHaveCount(3);
  const draftedWorkspace = await readWorkspace(page);
  const confirmedWords = new Set(draftedWorkspace.reflections.filter((reflection: { status: string }) => reflection.status === "confirmed").map((reflection: { text: string }) => reflection.text));
  const routeQuotes = draftedWorkspace.routeProposalSets.at(-1)!.routes.map((route: { sourceQuotes: Array<{ quote: string }> }) => route.sourceQuotes[0].quote);
  expect(routeQuotes).toHaveLength(3);
  expect(routeQuotes.every((quote: string) => confirmedWords.has(quote))).toBe(true);
  expect(new Set(routeQuotes).size).toBeGreaterThan(1);
  await expect(page.getByText(/best|recommended/i)).toHaveCount(0);

  const closest = routeCard(page, "closest");
  const bridge = routeCard(page, "bridge");
  const probe = routeCard(page, "probe");

  await closest.getByRole("button", { name: "Change" }).click();
  await expect(closest.getByLabel("Title")).toBeFocused();
  await closest.getByLabel("Title").fill("Make complex work clear");
  await closest.getByRole("button", { name: "Save changes" }).click();
  await expect(closest.getByRole("heading", { name: "Make complex work clear" })).toBeVisible();
  await expect(closest.getByText("Edited by you")).toBeVisible();

  await bridge.getByRole("button", { name: "Set aside" }).click();
  await bridge.getByRole("button", { name: "Set aside", exact: true }).last().click();
  await expect(bridge.getByText("Set aside", { exact: true })).toBeVisible();
  await expect(page.locator(".room__state")).toContainText("You set Bridge aside");

  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "Every change, in order" })).toBeFocused();
  const drawer = page.getByRole("dialog", { name: "Every change, in order" });
  await expect(drawer.getByText("You set aside Bridge")).toBeVisible();
  await expect(drawer.getByText("You edited Closest")).toBeVisible();
  await expect(drawer.getByText("You drafted three routes")).toBeVisible();
  await expect(drawer.getByText(/receipt \d+ · version \d+ to \d+/).first()).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: "History" })).toBeFocused();

  await probe.getByRole("button", { name: "Choose this test" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /You chose “/ })).toBeVisible();
  await expect(page.getByTestId("receipt-line")).toContainText("receipt");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: /You chose “/ })).toBeVisible();

  await page.getByRole("button", { name: "Reopen exploring" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Now three routes can be proposed." })).toBeVisible();
  await expect(page.getByText(/You parked/)).toBeVisible();
  await page.getByRole("button", { name: "Draft my own" }).click();
  await page.getByRole("button", { name: "Put these in my room" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Which direction is worth testing for a week?" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("start over clears the old journey and opens a fresh Deck", async ({ page }) => {
  await completeToHandoff(page, SHAPES[1][0], SHAPES[1][1]);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Now three routes can be proposed." })).toBeVisible();
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByRole("dialog", { name: "Start over on this device?" })).toBeVisible();
  await page.getByRole("button", { name: "Clear and start over" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "ChatGPT A/B Tests Your Future" })).toBeVisible();
  const keys = await page.evaluate(() => [localStorage.getItem("destiny-ai.workspace.v1"), localStorage.getItem("destiny-ai.journey.v2")]);
  expect(JSON.parse(keys[0]!)).toMatchObject({ schemaVersion: 4, phase: "DECK", swipes: [] });
  expect(keys[1]).toBeNull();
});

test("see what ChatGPT sees shows the exact orientation with confirmed words", async ({ page }) => {
  await completeToHandoff(page, SHAPES[0][0], SHAPES[0][1]);
  const trigger = page.getByRole("button", { name: "ChatGPT context" });
  await trigger.click();
  await expect(page.getByRole("heading", { name: "Everything the agent can read" })).toBeFocused();
  const json = await page.getByTestId("agent-view-json").innerText();
  const parsed = JSON.parse(json);
  expect(parsed.view).toBe("orientation");
  expect(parsed.confirmedWords.map((word: { text: string }) => word.text)).toContain(SHAPES[0][1]);
  expect(parsed.proposal.available).toBe(true);
  expect(json).not.toContain("draws");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("agent-view-json")).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("keyboard flow and focus management", async ({ page }) => {
  await page.getByRole("button", { name: "Start", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "What shape does stuck have today?" })).toBeFocused();
  await page.getByLabel(SHAPES[3][0]).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Your words").fill(SHAPES[3][1]);
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  const snapshot = await page.locator("main").ariaSnapshot();
  expect(snapshot).toContain("textbox \"Your words\"");
});

test("390px, 200% text, reduced motion, and forced colours keep the flow usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await completeToHandoff(page, SHAPES[0][0], SHAPES[0][1]);
  await page.getByRole("button", { name: "Draft my own" }).click();
  await page.getByRole("button", { name: "Put these in my room" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Which direction is worth testing for a week?" })).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
    transition: getComputedStyle(document.querySelector("button")!).transitionDuration,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
  expect(sizes.transition).toBe("0s");
});

test.skip("legacy broad visiting-agent catalogue is superseded by the six-tool ChatGPT experience", async ({ page }) => {
  await page.addInitScript(FAKE_MODEL_CONTEXT);
  await page.goto("/");
  await page.evaluate(({ key, workspace }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(workspace));
  }, { key: WORKSPACE_KEY, workspace: createEmptyWorkspace("00000000-0000-4000-8000-000000000322") });
  await page.reload();
  const errors = captureConsoleErrors(page);

  await expect(page.locator("[data-webmcp-status=registered]")).toBeVisible();
  expect(await agentTools(page)).toEqual(expect.arrayContaining(["read_workspace", "get_method_guide"]));
  expect(await agentTools(page)).not.toContain("propose_route_set");

  await completeToHandoff(page, SHAPES[0][0], SHAPES[0][1]);
  await expect(page.getByTestId("capability-line")).toContainText("propose three routes");
  await expect.poll(() => agentTools(page)).toContain("propose_route_set");

  const orientation = await agentCall(page, "read_workspace", { view: "orientation" });
  expect(orientation.ok).toBe(true);
  const words = orientation.data.confirmedWords as Array<{ ref: string; text: string }>;
  const caps = orientation.data.focus.costCaps as { hoursPerWeek: number; money: number; currency: string };
  expect(words.map((word) => word.text)).toContain(SHAPES[0][1]);

  // 1. The agent asks one question before proposing.
  const asked = await agentCall(page, "propose_route_set", {
    operationId: "00000000-0000-4000-8000-000000009001",
    expectedVersion: orientation.stateVersion,
    outcome: "insufficient_signal",
    followUpQuestion: "Which recent task felt absorbing enough to repeat?",
    reasonRefs: [words[0].ref],
  });
  expect(asked.ok).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: "One question first" })).toBeVisible();
  await expect(page.getByText("Which recent task felt absorbing enough to repeat?")).toBeVisible();
  await page.getByLabel("Your answer, in your words").fill("Untangling a messy handover so the next person could start calmly.");
  await page.getByRole("button", { name: "Answer", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Now three routes can be proposed." })).toBeVisible();

  // 2. The agent proposes three routes quoting the answer.
  const afterAnswer = await agentCall(page, "read_workspace", { view: "orientation" });
  const answerWord = (afterAnswer.data.confirmedWords as Array<{ ref: string; text: string }>).find((word) => word.text.includes("messy handover"))!;
  const proposed = await agentCall(page, "propose_route_set", {
    operationId: "00000000-0000-4000-8000-000000009002",
    expectedVersion: afterAnswer.stateVersion,
    outcome: "routes",
    routes: agentRoutes(words[0], answerWord, caps, "a"),
  });
  expect(proposed.ok).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: "Three directions. You pick the one to test." })).toBeVisible();
  await expect(page.getByTestId("provenance")).toHaveText("Proposed by ChatGPT");
  await expect(page.locator(".status-region--room")).toContainText("ChatGPT proposed three routes");

  await page.getByRole("button", { name: "History" }).click();
  const drawer = page.getByRole("dialog", { name: "Every change, in order" });
  await expect(drawer.getByText("ChatGPT proposed three routes")).toBeVisible();
  await expect(drawer.getByText("ChatGPT asked one question before proposing")).toBeVisible();
  await expect(drawer.getByText("You answered the question")).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();

  // Grounding highlight: hovering a route marks its quote in the words panel.
  await routeCard(page, "closest").hover();
  await expect(page.locator(".words-panel mark").first()).toBeVisible();

  // 3. A denied proposal is visible to the human and changes nothing.
  const denied = await agentCall(page, "propose_route_set", {
    operationId: "00000000-0000-4000-8000-000000009003",
    expectedVersion: proposed.stateVersion,
    outcome: "routes",
    routes: agentRoutes(words[0], answerWord, caps, "b"),
    supersedesRouteSetRef: proposed.data.routeSet.ref,
  });
  expect(denied.ok).toBe(false);
  await expect(page.locator(".notice--warning")).toContainText("Nothing changed");

  // 4. The participant sets Probe aside; the agent may replace only Probe.
  const probe = routeCard(page, "probe");
  await probe.getByRole("button", { name: "Set aside" }).click();
  await probe.getByRole("button", { name: "Set aside", exact: true }).last().click();
  await expect(page.getByTestId("capability-line").or(page.locator(".room__state"))).toContainText(/replace/);
  const current = await agentCall(page, "read_workspace", { view: "orientation" });
  expect(current.data.proposal.mode).toBe("replace_rejected");
  const carryRefs = current.data.proposal.carryRouteRefs as string[];
  const replacement = agentRoutes(words[0], answerWord, caps, "c")[2];
  const replaced = await agentCall(page, "propose_route_set", {
    operationId: "00000000-0000-4000-8000-000000009004",
    expectedVersion: current.stateVersion,
    outcome: "routes",
    routes: [{ carryRouteRef: carryRefs[0] }, { carryRouteRef: carryRefs[1] }, replacement],
    supersedesRouteSetRef: current.data.proposal.supersedesRouteSetRef,
  });
  expect(replaced.ok).toBe(true);
  await expect(page.getByText("Replaced by ChatGPT")).toBeVisible();
  await expect(page.getByText("Kept from your last set").first()).toBeVisible();
  await expect(page.locator(".status-region--room")).toContainText("replaced the route you set aside");

  // 5. The participant chooses; the agent reads it back exactly.
  await routeCard(page, "closest").getByRole("button", { name: "Choose this test" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /You chose “/ })).toBeVisible();
  const reread = await agentCall(page, "read_workspace", { view: "orientation" });
  expect(reread.data.active.hypothesis.status).toBe("accepted");
  expect(reread.data.latestChange.command).toBe("choose_route");
  expect(await agentTools(page)).not.toContain("propose_route_set");
  expect(errors).toEqual([]);
});

// ---- helpers ----------------------------------------------------------------------------------

async function completeToHandoff(page: Page, shape: string, firstAnswer: string, skipLast = false) {
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByLabel(shape).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await answerQuestion(page, firstAnswer);
  await answerQuestion(page, SECOND_ANSWER);
  if (skipLast) {
    await page.getByRole("button", { name: "Skip" }).click();
  } else {
    await answerQuestion(page, THIRD_ANSWER);
  }
  await expect(page.getByRole("heading", { level: 1, name: "Do these still sound like you?" })).toBeVisible();
  await page.getByRole("button", { name: "Use these words" }).click();
  await page.getByLabel("Time each week").fill("3");
  await page.getByLabel("Most you would spend on one test").fill("500");
  await page.getByLabel("Currency").fill("INR");
  await page.getByRole("button", { name: "Save my words and limits" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Now three routes can be proposed." })).toBeVisible();
}

async function answerQuestion(page: Page, text: string) {
  await page.getByLabel("Your words").fill(text);
  await page.getByRole("button", { name: "Continue" }).click();
}

function routeCard(page: Page, kind: "closest" | "bridge" | "probe") {
  return page.locator(`article.route-card--${kind}`);
}

async function readWorkspace(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), WORKSPACE_KEY);
}

async function agentTools(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __destinyAgent: { tools(): Promise<string[]> } }).__destinyAgent.tools());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function agentCall(page: Page, name: string, input: unknown): Promise<any> {
  const result = await page.evaluate(
    ([toolName, toolInput]) => (window as unknown as { __destinyAgent: { call(name: string, input: unknown): Promise<unknown> } }).__destinyAgent.call(toolName as string, toolInput),
    [name, input],
  );
  if (typeof result === "string") return JSON.parse(result);
  const text = (result as { content?: Array<{ type?: string; text?: string }> } | null)?.content?.find((item) => item.type === "text")?.text;
  return text ? JSON.parse(text) : result;
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

function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
