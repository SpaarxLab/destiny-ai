import { expect, test, type Page } from "@playwright/test";

/**
 * The whole house match in a real browser, phone first, then desktop.
 * STING_PLAYER=off in the Playwright web server, so the house plays deterministically.
 */

async function playThroughToCard(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("thinks it knows what you want");
  await page.getByRole("button", { name: "Play" }).click();

  // Cast: eight posters, three picks.
  const posters = page.locator(".sting-grid .poster");
  await expect(posters).toHaveCount(8);
  await expect(page.getByRole("heading", { level: 2 })).toContainText("wish were yours");
  await posters.nth(0).click();
  await expect(page.getByRole("heading", { level: 2 })).toContainText("One more");
  await posters.nth(7).click();
  await expect(page.getByRole("heading", { level: 2 })).toContainText("never admit");
  await posters.nth(6).click();

  // Duels: the seal is visible before every tap, then a reveal, up to nine times.
  let asked = false;
  for (let i = 0; i < 10; i += 1) {
    const seal = page.locator(".seal");
    const verdict = page.getByText(/earned a guess|never earned|went bust/i).first();
    const question = page.locator(".ask .ask__option");
    await Promise.race([seal.waitFor({ state: "visible", timeout: 15_000 }), verdict.waitFor({ state: "visible", timeout: 15_000 }), question.first().waitFor({ state: "visible", timeout: 15_000 })]);
    if (await verdict.isVisible().catch(() => false)) break;
    if (!asked && (await question.first().isVisible().catch(() => false))) {
      // The house spent a chip to ask one thing; only a tap answers it.
      await expect(page.locator(".ask")).toContainText("spent a chip");
      await question.nth(1).click();
      await expect(page.locator(".ask")).toHaveCount(0);
      asked = true;
      i -= 1;
      continue;
    }
    await expect(seal).toContainText(/has bet \d chips?/);
    await expect(page.locator(".seal")).toContainText(/· [0-9a-f]{4}/);
    const duel = page.locator(".duel .poster");
    await expect(duel).toHaveCount(2);
    // Keep the quiet side except on the third duel, so the house is wrong at least once.
    await duel.nth(i === 2 ? 0 : 1).click();
    await expect(page.locator(".reveal")).toBeVisible();
    await expect(page.locator(".reveal")).toContainText(/bet/);
  }

  // Verdict: lines always arrive, earned or marked unearned, and the match always goes on.
  await expect(page.getByRole("button", { name: "Keep what’s left" })).toBeVisible({ timeout: 20_000 });
  await page.locator(".proof summary").first().click();
  await expect(page.locator(".proof li").first()).toContainText("You picked");

  // Kill one line with the visible ✕ and confirm.
  const lineCount = await page.locator(".line").count();
  expect(lineCount).toBeGreaterThanOrEqual(2);
  await page.locator(".line").last().getByRole("button", { name: /^Not me/ }).click();
  await page.getByRole("button", { name: "Not me", exact: true }).click();
  await expect(page.locator(".line")).toHaveCount(lineCount - 1, { timeout: 5_000 });
  await page.getByRole("button", { name: "Keep what’s left" }).click();

  // Fight if two hungers survived.
  const fight = page.locator(".fight__side");
  const lives = page.getByText("Three lives that survived");
  await Promise.race([fight.first().waitFor({ timeout: 15_000 }), lives.waitFor({ timeout: 15_000 })]);
  if (await fight.first().isVisible().catch(() => false)) {
    await fight.first().click();
  }

  // Three lives, pick one, take the dare.
  await expect(page.locator(".sting-grid .poster")).toHaveCount(3, { timeout: 15_000 });
  await page.locator(".sting-grid .poster").first().click();
  await page.getByRole("button", { name: "Test this life" }).click();
  await expect(page.getByRole("button", { name: "Take the dare" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Take the dare" }).click();
  await expect(page.getByText("your card")).toBeVisible();
  await expect(page.locator(".card")).toContainText(/right/);
  await expect(page.locator(".helper")).toContainText("HOW TO HELP ME", { timeout: 30_000 });
  expect(asked).toBe(true);

  // The letter: sealed now, hash visible, contents hidden; opened only once the dare is due (demo clock +8 days).
  await expect(page.locator(".letter")).toContainText(/sealed letter about your week · [0-9a-f]{4}/, { timeout: 15_000 });
  await expect(page.locator(".letter")).toContainText("Come back");
  await page.goto("/?clock=+8d");
  await expect(page.getByRole("button", { name: "I did it" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "I did it" }).click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(page.locator(".letter--open")).toContainText(/called your week (right|wrong)/);
  await page.locator(".letter--open").getByRole("button", { name: "verify the seal" }).click();
  await expect(page.locator(".letter--open")).toContainText("matches ✓");
  return "card" as const;
}

test.describe("STING house match", () => {
  test.setTimeout(150_000);
  test("plays cast to card on a phone with sealed bets, proof, a kill and a dare", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
    });
    const outcome = await playThroughToCard(page);
    expect(["card", "no-ai"]).toContain(outcome);
    await page.screenshot({ path: "test-results/sting-card-phone.png", fullPage: true, animations: "disabled" });
    expect(errors.filter((text) => !text.includes("Download the React DevTools"))).toEqual([]);
  });

  test("survives a reload mid-duel with the same sealed bet", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Play" }).click();
    const posters = page.locator(".sting-grid .poster");
    await expect(posters).toHaveCount(8);
    await posters.nth(1).click();
    await posters.nth(2).click();
    await posters.nth(3).click();
    const seal = page.locator(".seal");
    await expect(seal).toBeVisible({ timeout: 15_000 });
    const before = await seal.textContent();
    await page.reload();
    await expect(page.locator(".seal")).toBeVisible({ timeout: 15_000 });
    expect(await page.locator(".seal").textContent()).toBe(before);
    await expect(page.locator(".duel .poster")).toHaveCount(2);
  });

  test("renders the door and cast on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.screenshot({ path: "test-results/sting-door-desktop.png", animations: "disabled" });
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.locator(".sting-grid .poster")).toHaveCount(8);
    await page.screenshot({ path: "test-results/sting-cast-desktop.png", animations: "disabled" });
  });
});
