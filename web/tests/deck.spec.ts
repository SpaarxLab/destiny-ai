import { expect, test, type Page } from "@playwright/test";

const WORKSPACE_KEY = "destiny-ai.workspace.v1";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("fresh workspace deals a tactile card and only the participant can swipe it", async ({ page }) => {
  const errors = captureConsoleErrors(page);
  await expect(page.getByRole("heading", { level: 1, name: "The Deck" })).toBeVisible();
  await expect(page.locator(".moment-card")).toBeVisible();
  await expect(page.getByText("only you swipe")).toBeVisible();

  const tools = await page.evaluate(async () => {
    const context = (document as Document & { modelContext?: { getTools?(): Promise<{ name: string }[]> } }).modelContext;
    return context?.getTools ? (await context.getTools()).map((tool) => tool.name) : [];
  });
  expect(tools).not.toContain("swipe_card");

  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".tension-rail .pile strong")).toHaveText("1");
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), WORKSPACE_KEY);
  expect(stored.phase).toBe("DECK");
  expect(stored.swipes).toHaveLength(1);
  expect(stored.swipes[0].gesture).toBe("me");
  expect(stored.operations.some((operation: { command: string }) => operation.command === "swipe_card")).toBe(true);
  expect(errors).toEqual([]);
});

test("Deck remains usable at a 390px phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { level: 1, name: "The Deck" })).toBeVisible();
  await expect(page.locator(".moment-card")).toBeVisible();
  await expect(page.locator(".gesture-cross")).toBeVisible();
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(390);
});

function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
