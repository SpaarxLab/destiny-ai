import { expect, test, type Page } from "@playwright/test";

const WORKSPACE_KEY = "destiny-ai.workspace.v1";

test.beforeEach(async ({ page }) => {
  await page.goto("/legacy");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("fresh workspace shows four explicit participant reactions", async ({ page }) => {
  const errors = captureConsoleErrors(page);
  await expect(page.getByRole("heading", { level: 1, name: "A/B test my future" })).toBeVisible();
  await expect(page.locator(".moment-card")).toBeVisible();

  const tools = await page.evaluate(async () => {
    const context = (document as Document & { modelContext?: { getTools?(): Promise<{ name: string }[]> } }).modelContext;
    return context?.getTools ? (await context.getTools()).map((tool) => tool.name) : [];
  });
  expect(tools).not.toContain("swipe_card");

  const cardText = await page.locator(".moment-card h2").textContent();
  await page.locator(".moment-card").click();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null").swipes, WORKSPACE_KEY)).toHaveLength(0);

  for (const name of ["Not me", "I wish", "I used to", "That's me"]) {
    await expect(page.getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  expect(cardText).toBeTruthy();

  await page.getByRole("button", { name: /^That's me/ }).click();
  await page.getByRole("button", { name: "Skip the reason" }).click();
  await expect(page.locator(".reaction-totals .pile").filter({ hasText: "That's me" }).locator("strong")).toHaveText("1");
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), WORKSPACE_KEY);
  expect(stored.phase).toBe("DECK");
  expect(stored.swipes).toHaveLength(1);
  expect(stored.swipes[0].gesture).toBe("me");
  expect(stored.operations.some((operation: { command: string }) => operation.command === "swipe_card")).toBe(true);
  expect(errors).toEqual([]);
});

test("skipping the suggested reasons preserves the explicitly chosen reaction", async ({ page }) => {
  const errors = captureConsoleErrors(page);
  await page.getByRole("button", { name: /^I wish/ }).click();
  await expect(page.getByText("Your reaction", { exact: true })).toBeVisible();
  await expect(page.getByText("Choosing a reason will keep your I wish reaction.")).toBeVisible();
  await page.getByRole("button", { name: "Skip the reason" }).click();

  await expect(page.locator(".evidence-rail > summary strong")).toHaveText("1");
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), WORKSPACE_KEY);
  expect(stored.swipes).toHaveLength(1);
  expect(stored.swipes[0].gesture).toBe("wish");
  expect(stored.swipes[0].tappedReasonIndex).toBeUndefined();
  expect(stored.reflections).toHaveLength(0);
  expect(errors).toEqual([]);
});

test("a dealer note appears and remains a participant decision", async ({ page }) => {
  await expect.poll(() => page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    try {
      return Array.isArray(JSON.parse(raw).dealerNotes);
    } catch {
      return false;
    }
  }, WORKSPACE_KEY)).toBe(true);

  await page.evaluate((key) => {
    const workspace = JSON.parse(localStorage.getItem(key) ?? "null");
    workspace.dealerNotes.push({ id: "8a0a0000-0000-4000-8000-000000000011", ref: "note-browser-1", availableActions: [], text: "A visiting agent can propose this note, but only you can dismiss it.", status: "visible", postedBy: { source: "other_webmcp", role: "dealer", label: "Visiting agent" }, createdAt: "2026-09-02T08:00:00.000Z" });
    localStorage.setItem(key, JSON.stringify(workspace));
  }, WORKSPACE_KEY);
  await page.reload();

  const note = page.getByText("A visiting agent can propose this note, but only you can dismiss it.");
  await expect(note).toBeVisible();
  await page.getByRole("button", { name: "Dismiss note from Visiting agent" }).click();
  await expect(note).not.toBeVisible();
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), WORKSPACE_KEY);
  expect(stored.dealerNotes[0].status).toBe("dismissed");
});

test("reaction and reason selection work with the keyboard", async ({ page }) => {
  const reaction = page.getByRole("button", { name: /^Not me/ });
  await reaction.focus();
  await page.keyboard.press("Enter");
  await expect(reaction).toHaveAttribute("aria-pressed", "true");
  const firstReason = page.locator(".reason-choice").first();
  await expect(firstReason).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.locator(".evidence-rail > summary strong")).toHaveText("1");
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), WORKSPACE_KEY);
  expect(stored.swipes[0].gesture).toBe("not_me");
  expect(stored.swipes[0].tappedReasonIndex).toBe(0);
  await expect(page.locator(".reaction-choice").first()).toBeFocused();
});

test("every visible reaction commits itself and its chosen reason", async ({ page }) => {
  const reactions = [
    { name: /^That's me/, gesture: "me" },
    { name: /^Not me/, gesture: "not_me" },
    { name: /^I wish/, gesture: "wish" },
    { name: /^I used to/, gesture: "used_to" },
  ];

  for (const [index, reaction] of reactions.entries()) {
    await page.getByRole("button", { name: reaction.name }).click();
    await expect(page.getByRole("button", { name: reaction.name })).toHaveAttribute("aria-pressed", "true");
    await page.locator(".reason-choice").nth(index % 3).click();
    await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.swipes?.length ?? 0, WORKSPACE_KEY)).toBe(index + 1);
  }

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), WORKSPACE_KEY);
  expect(stored.swipes.map((swipe: { gesture: string }) => swipe.gesture)).toEqual(["me", "not_me", "wish", "used_to"]);
  expect(stored.swipes.map((swipe: { tappedReasonIndex: number }) => swipe.tappedReasonIndex)).toEqual([0, 1, 2, 0]);
});

test("choosing a reason refreshes the deck even when device haptics fail", async ({ page }) => {
  const errors = captureConsoleErrors(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: () => { throw new Error("Haptics unavailable"); },
    });
  });

  await page.getByRole("button", { name: /^That's me/ }).click();
  await page.locator(".reason-choice").first().click();

  await expect(page.locator(".evidence-rail > summary strong")).toHaveText("1");
  await expect(page.locator(".reaction-totals .pile").filter({ hasText: "That's me" }).locator("strong")).toHaveText("1");
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), WORKSPACE_KEY);
  expect(stored.swipes).toHaveLength(1);
  expect(stored.swipes[0].tappedReasonIndex).toBe(0);
  expect(stored.reflections).toHaveLength(1);
  expect(stored.reflections[0].recordedBy).toBe("participant_tapped");
  expect(errors).toEqual([]);
});

test("Deck remains usable at a 390px phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { level: 1, name: "A/B test my future" })).toBeVisible();
  await expect(page.locator(".moment-card")).toBeVisible();
  await expect(page.locator(".reaction-grid")).toBeVisible();
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(390);
  const pileBounds = await page.locator(".reaction-choice").evaluateAll((piles) => piles.map((pile) => {
    const bounds = pile.getBoundingClientRect();
    return { left: bounds.left, right: bounds.right, viewport: document.documentElement.clientWidth };
  }));
  expect(pileBounds.every(({ left, right, viewport }) => left >= 0 && right <= viewport), JSON.stringify(pileBounds)).toBe(true);
});

test.skip("legacy fixture Reader and Portrait remain available only to explicit local development", async ({ page }) => {
  test.setTimeout(60_000);
  await dealTwelveWithReasons(page);

  const tensionDialog = page.getByRole("dialog", { name: /Reader · a tension/ });
  await expect(tensionDialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest("dialog") !== null)).toBe(true);
  await tensionDialog.getByRole("button", { name: "Rewrite" }).click();
  await expect(tensionDialog.getByLabel("Rewrite this tension in your words")).toBeVisible();
  await tensionDialog.getByRole("button", { name: "Save rewritten tension" }).click();

  await expect(tensionDialog).toBeVisible();
  await tensionDialog.getByRole("button", { name: "Keep this tension" }).click();

  const portraitDialog = page.getByRole("dialog", { name: "Not a type. The tensions you chose to keep." });
  await expect(portraitDialog).toBeVisible();
  await portraitDialog.getByRole("button", { name: "Keep sorting first" }).click();
  await expect(page.getByText("Keep sorting · one more honest card")).toBeVisible();

  await page.getByRole("button", { name: /^That's me/ }).click();
  await page.locator(".reason-choice").first().click();
  await expect(portraitDialog).toBeVisible();
});

function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function dealTwelveWithReasons(page: Page) {
  for (let index = 0; index < 12; index += 1) {
    await page.getByRole("button", { name: /^That's me/ }).click();
    await page.locator(".reason-choice").first().click();
    await expect(page.getByText(index === 11 ? "Reading the pattern" : `Card ${index + 2} of 16`)).toBeVisible();
  }
}
