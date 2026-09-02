import { expect, test, type Page } from "@playwright/test";

const WORKSPACE_KEY = "destiny-ai.workspace.v1";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("fresh workspace deals a tactile card and only the participant can swipe it", async ({ page }) => {
  const errors = captureConsoleErrors(page);
  await expect(page.getByRole("heading", { level: 1, name: "ChatGPT A/B Tests Your Future" })).toBeVisible();
  await expect(page.locator(".moment-card")).toBeVisible();
  await expect(page.getByText("only you respond and decide")).toBeVisible();

  const tools = await page.evaluate(async () => {
    const context = (document as Document & { modelContext?: { getTools?(): Promise<{ name: string }[]> } }).modelContext;
    return context?.getTools ? (await context.getTools()).map((tool) => tool.name) : [];
  });
  expect(tools).not.toContain("swipe_card");

  await page.locator(".moment-card__front").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".tension-rail .pile strong")).toHaveText("1");
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), WORKSPACE_KEY);
  expect(stored.phase).toBe("DECK");
  expect(stored.swipes).toHaveLength(1);
  expect(stored.swipes[0].gesture).toBe("me");
  expect(stored.operations.some((operation: { command: string }) => operation.command === "swipe_card")).toBe(true);
  expect(errors).toEqual([]);
});

test("skipping the suggested reasons still commits the chosen pile", async ({ page }) => {
  const errors = captureConsoleErrors(page);
  await page.locator(".moment-card__front").click();
  await page.getByRole("button", { name: "None of these" }).click();

  await expect(page.getByText(/Probe 2 of 5 max/)).toBeVisible();
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), WORKSPACE_KEY);
  expect(stored.swipes).toHaveLength(1);
  expect(stored.swipes[0].gesture).toBe("me");
  expect(stored.swipes[0].tappedReasonIndex).toBeUndefined();
  expect(stored.reflections).toHaveLength(0);
  expect(errors).toEqual([]);
});

test("a dealer note appears and remains a participant decision", async ({ page }) => {
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

test("the card exposes one keyboard surface at a time", async ({ page }) => {
  const front = page.locator(".moment-card__front");
  const firstReason = page.locator(".reason-choice").first();
  await expect(front).toHaveAttribute("tabindex", "0");
  await expect(firstReason).toHaveAttribute("tabindex", "-1");

  await front.focus();
  await page.keyboard.press("Enter");
  await expect(firstReason).toBeFocused();
  await expect(front).toHaveAttribute("tabindex", "-1");
  await page.keyboard.press("2");

  await expect(page.getByText(/Probe 2 of 5 max/)).toBeVisible();
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), WORKSPACE_KEY);
  expect(stored.swipes[0].tappedReasonIndex).toBe(1);
  await expect(page.locator(".moment-card__front")).toBeFocused();
});

test("dragging the card reaches all four piles", async ({ page }) => {
  await dragCurrentCard(page, 120, 0);
  await dragCurrentCard(page, -120, 0);
  await dragCurrentCard(page, 0, -120);
  await dragCurrentCard(page, 0, 120);

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), WORKSPACE_KEY);
  expect(stored.swipes.map((swipe: { gesture: string }) => swipe.gesture)).toEqual(["me", "not_me", "wish", "used_to"]);
});

test("choosing a reason refreshes the deck even when device haptics fail", async ({ page }) => {
  const errors = captureConsoleErrors(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: () => { throw new Error("Haptics unavailable"); },
    });
  });

  await page.locator(".moment-card").click();
  await expect(page.locator(".moment-card")).toHaveClass(/is-flipped/);
  await page.locator(".moment-card__back button").first().click();

  await expect(page.getByText(/Probe 2 of 5 max/)).toBeVisible();
  await expect(page.locator(".tension-rail .pile strong")).toHaveText("1");
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), WORKSPACE_KEY);
  expect(stored.swipes).toHaveLength(1);
  expect(stored.swipes[0].tappedReasonIndex).toBe(0);
  expect(stored.reflections).toHaveLength(1);
  expect(stored.reflections[0].recordedBy).toBe("participant_tapped");
  expect(errors).toEqual([]);
});

test("Deck remains usable at a 390px phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { level: 1, name: "ChatGPT A/B Tests Your Future" })).toBeVisible();
  await expect(page.locator(".moment-card")).toBeVisible();
  await expect(page.locator(".gesture-cross")).toBeVisible();
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(390);
  const pileBounds = await page.locator(".pile-bank--mobile .pile").evaluateAll((piles) => piles.map((pile) => {
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

  await page.locator(".moment-card__front").click();
  await page.locator(".reason-choice").first().click();
  await expect(portraitDialog).toBeVisible();
});

function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function dragCurrentCard(page: Page, deltaX: number, deltaY: number) {
  const initialSwipeCount = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.swipes?.length ?? 0, WORKSPACE_KEY);
  const front = page.locator(".moment-card__front");
  await front.scrollIntoViewIfNeeded();
  const bounds = await front.boundingBox();
  if (!bounds) throw new Error("Deck card has no visible bounds");
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y + deltaY, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.swipes?.length ?? 0, WORKSPACE_KEY)).toBe(initialSwipeCount + 1);
}

async function dealTwelveWithReasons(page: Page) {
  for (let index = 0; index < 12; index += 1) {
    await page.locator(".moment-card__front").click();
    await page.locator(".reason-choice").first().click();
    await expect(page.getByText(index === 11 ? "Reading the pattern" : `Card ${index + 2} of 16`)).toBeVisible();
  }
}
