import { expect, test, type Page } from "@playwright/test";

const FAKE_MODEL_CONTEXT = `
  (() => {
    const registrations = [];
    const context = {
      async registerTool(tool, options) { registrations.push({ tool, signal: options && options.signal }); },
      async getTools() { return registrations.filter((entry) => !(entry.signal && entry.signal.aborted)).map((entry) => ({ name: entry.tool.name })); },
      async executeTool(tool, input) {
        const live = registrations.filter((entry) => !(entry.signal && entry.signal.aborted) && entry.tool.name === tool.name).at(-1);
        if (!live) throw new Error("no live tool " + tool.name);
        return live.tool.execute(typeof input === "string" ? JSON.parse(input) : input);
      },
    };
    Object.defineProperty(document, "modelContext", { value: context, configurable: true });
    window.__destinyAgent = {
      async tools() { return (await context.getTools()).map((tool) => tool.name); },
      async call(name, input) {
        const tool = (await context.getTools()).find((candidate) => candidate.name === name);
        return context.executeTool(tool, JSON.stringify(input));
      },
    };
  })();
`;

test("ChatGPT stages a recoverable probe and receives only the participant's webpage response", async ({ page }) => {
  const errors = captureConsoleErrors(page);
  await page.addInitScript(FAKE_MODEL_CONTEXT);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.locator("[data-webmcp-status=registered]")).toBeVisible();
  expect(await tools(page)).toEqual(["inspect_room", "stage_probe", "propose_hypothesis", "present_evidence", "stage_route_auditions", "propose_experiment"]);
  await expect(page.locator(".moment-card")).toHaveCount(0);

  const staged = await call(page, "stage_probe", {
    operationId: "0a510000-0000-4000-8000-000000000001", expectedVersion: 0,
    template: "moment", uncertainty: "Whether shaping an ambiguous problem creates useful energy.",
    variables: ["ambiguity", "ownership"], changedVariable: "ownership of the first draft",
    strengthensWhen: "the participant chooses That's me or I wish", weakensWhen: "the participant chooses Not me",
    scenarios: [{ text: "A vague brief lands at noon. By four, you have drawn the system everyone can finally discuss.", axis: "making_deciding", pole: "a", reasons: ["I want to shape the answer myself.", "The ambiguity gives me useful energy.", "I care about making the system clear."] }],
  });
  expect(staged).toMatchObject({ ok: true, outcome: "awaiting_participant", stateVersion: 1, recovery: { stagedProbePreserved: true } });
  await expect(page.locator(".moment-card")).toBeVisible();
  await expect(page.getByText("A new situation is ready for your response.")).toBeVisible();

  await page.getByRole("button", { name: /That's me/ }).click();
  await page.getByRole("button", { name: "I want to shape the answer myself." }).click();
  await expect(page.locator(".moment-card")).toHaveCount(0);

  const inspected = await call(page, "inspect_room", {});
  expect(inspected).toMatchObject({ ok: true, stateVersion: 2, data: { confirmedEvidence: [{ response: { code: "me", selectedReason: "I want to shape the answer myself." }, receiptRef: "operation-2" }], latestAuthoritativeReceipt: { command: "swipe_card", actor: "participant" } } });

  const second = await call(page, "stage_probe", {
    operationId: "0a510000-0000-4000-8000-000000000002", expectedVersion: 2,
    template: "variable_isolation", uncertainty: "Whether visibility changes the reaction when the work stays the same.",
    variables: ["work", "visibility"], changedVariable: "who sees the result",
    strengthensWhen: "the reaction changes with visibility", weakensWhen: "the reaction stays the same",
    reversalOfProbeRef: "card-1-1-v2",
    scenarios: [{ text: "You draw the same useful system, but only one trusted collaborator will ever see it.", axis: "visible_hidden", pole: "b" }],
  });
  expect(second).toMatchObject({ ok: true, stateVersion: 3 });
  await page.reload();
  await expect(page.locator(".moment-card")).toBeVisible();
  const recovered = await call(page, "inspect_room", {});
  expect(recovered).toMatchObject({ ok: true, stateVersion: 3, data: { openParticipantDecision: { kind: "RESPOND_TO_PROBE" }, recovery: { status: "awaiting_participant" } } });
  expect(errors).toEqual([]);
});

async function tools(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __destinyAgent: { tools(): Promise<string[]> } }).__destinyAgent.tools());
}

async function call(page: Page, name: string, input: unknown): Promise<Record<string, unknown>> {
  const result = await page.evaluate(([toolName, toolInput]) => (window as unknown as { __destinyAgent: { call(name: string, input: unknown): Promise<{ content?: Array<{ text?: string }> }> } }).__destinyAgent.call(toolName as string, toolInput), [name, input]);
  const text = result.content?.[0]?.text;
  return text ? JSON.parse(text) as Record<string, unknown> : result as Record<string, unknown>;
}

function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
