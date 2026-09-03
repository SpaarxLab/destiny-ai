import { expect, test } from "@playwright/test";

/** A real match against Spark (Muse Spark 1.3 through OpenCode Go). Screenshots every screen. Not part of `npm run check`. */
test("Spark plays a whole match", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const shots: string[] = [];
  const shot = async (name: string) => {
    const path = `test-results/live-${String(shots.length + 1).padStart(2, "0")}-${name}.png`;
    await page.screenshot({ path, fullPage: true, animations: "disabled" });
    shots.push(path);
  };
  const log: string[] = [];
  page.on("response", async (response) => {
    if (response.url().includes("/api/sting/move") && response.request().method() === "POST") {
      const body = await response.json().catch(() => ({}));
      log.push(`${response.status()} ${body.move ?? body.code} ${body.ms ?? ""}ms`);
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Spark thinks it knows");
  await shot("door");
  await page.getByRole("button", { name: "Play" }).click();
  const posters = page.locator(".sting-grid .poster:not(.skeleton)");
  await expect(posters).toHaveCount(8, { timeout: 60_000 });
  await shot("cast");
  await posters.nth(2).click();
  await page.waitForTimeout(900);
  await posters.nth(5).click();
  await page.waitForTimeout(600);
  await posters.nth(6).click();
  await shot("picks");

  let asked = false;
  for (let i = 0; i < 10; i += 1) {
    const seal = page.locator(".seal");
    const verdict = page.getByText(/earned a guess|never earned|went bust/i).first();
    const question = page.locator(".ask .ask__option");
    await Promise.race([seal.waitFor({ state: "visible", timeout: 60_000 }), verdict.waitFor({ state: "visible", timeout: 60_000 }), question.first().waitFor({ state: "visible", timeout: 60_000 })]);
    if (await verdict.isVisible().catch(() => false)) break;
    if (!asked && (await question.first().isVisible().catch(() => false))) {
      await shot("question");
      await question.nth(1).click();
      await expect(page.locator(".ask")).toHaveCount(0);
      asked = true;
      i -= 1;
      continue;
    }
    await expect(seal).toContainText(/has bet \d chips?/);
    if (i === 0) await shot("duel");
    const duel = page.locator(".duel .poster");
    await expect(duel).toHaveCount(2);
    await page.waitForTimeout(i === 1 ? 2800 : 700);
    await duel.nth(i % 3 === 2 ? 0 : 1).click();
    await expect(page.locator(".reveal")).toBeVisible();
    if (i === 0 || i === 2) await shot(`reveal-${i + 1}`);
  }

  const earned = page.getByRole("button", { name: "Keep what’s left" });
  await earned.waitFor({ timeout: 90_000 });
  await shot("verdict");
  await page.locator(".proof summary").first().click();
  await shot("proof");
  await page.locator(".line").last().getByRole("button", { name: /^Not me/ }).click();
  await page.getByRole("button", { name: "Not me", exact: true }).click();
  await page.waitForTimeout(900);
  await earned.click();
  const fight = page.locator(".fight__side");
  const lives = page.getByText("Three lives that survived");
  await Promise.race([fight.first().waitFor({ timeout: 60_000 }), lives.waitFor({ timeout: 60_000 })]);
  if (await fight.first().isVisible().catch(() => false)) {
    await shot("fight");
    await fight.first().click();
  }
  await expect(page.locator(".sting-grid .poster")).toHaveCount(3, { timeout: 90_000 });
  await shot("lives");
  await page.locator(".sting-grid .poster").first().click();
  await page.getByRole("button", { name: "Test this life" }).click();
  await expect(page.getByRole("button", { name: "Take the dare" })).toBeVisible({ timeout: 90_000 });
  await shot("dare");
  await page.getByRole("button", { name: "Take the dare" }).click();
  await expect(page.getByText("your card")).toBeVisible();
  await shot("card");
  console.log(log.join("\n"));
});
