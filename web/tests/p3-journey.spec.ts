import { expect, test, type Page } from "@playwright/test";

const SHAPES = [
  ["Too many paths", "I keep returning to making complicated work easier to understand."],
  ["Nothing fits", "Work felt worthwhile when I helped a teammate see a difficult problem clearly."],
  ["I need a safer next move", "My next move needs to protect my energy and financial stability."],
  ["I want to write it my way", "How can I find work that uses both careful thinking and clear communication?"],
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

for (const [shape, firstAnswer] of SHAPES) {
  test(`${shape} reaches three equal routes without a provider`, async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await completeJourneyToRoutes(page, shape, firstAnswer, shape === "I want to write it my way");

    await expect(page.getByRole("heading", { level: 1, name: "Three directions. No winner picked for you." })).toBeVisible();
    await expect(page.getByText("Closest", { exact: true })).toBeVisible();
    await expect(page.getByText("Bridge", { exact: true })).toBeVisible();
    await expect(page.getByText("Probe", { exact: true })).toBeVisible();
    await expect(page.locator("[data-webmcp-status=unsupported]")).toContainText("Human mode");
    await expect(page.getByText(/best|recommended/i)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("saves and resumes the exact question and answer", async ({ page }) => {
  const errors = captureConsoleErrors(page);
  await page.getByRole("button", { name: "Start my journey" }).click();
  await page.getByLabel("Too many paths").check();
  await page.getByRole("button", { name: "Continue" }).click();
  const answer = "I keep returning to untangling systems for other people.";
  await page.getByLabel("Your words").fill(answer);
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("Too many paths")).toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Your words")).toHaveValue(answer);
  await page.getByRole("button", { name: "Save and exit" }).click();

  await expect(page.getByRole("heading", { name: "Your place is here when you return" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Continue my journey" }).click();
  await expect(page.getByLabel("Your words")).toHaveValue(answer);
  expect(errors).toEqual([]);
});

test("marks, compares, edits, rejects, and chooses through one human action", async ({ page }) => {
  const errors = captureConsoleErrors(page);
  await completeJourneyToRoutes(page, SHAPES[0][0], SHAPES[0][1]);

  const closest = routeCard(page, "Closest");
  const bridge = routeCard(page, "Bridge");
  await closest.getByLabel("What draws me in").fill("I can begin with skills I already use.");
  await closest.getByLabel("What worries me").fill("It may feel too familiar.");
  await closest.getByLabel("What this could teach me").fill("Whether clarity work gives me energy.");
  await page.reload();
  await expect(closest.getByLabel("What draws me in")).toHaveValue("I can begin with skills I already use.");
  await page.getByRole("button", { name: "Compare my marks" }).click();
  await expect(page.getByRole("heading", { name: "See your marks side by side" })).toBeVisible();
  await expect(page.locator(".comparison-board").getByText("I can begin with skills I already use.")).toBeVisible();

  await closest.getByRole("button", { name: "Edit this route" }).click();
  await closest.getByRole("button", { name: "Cancel" }).click();
  await expect(closest.getByRole("button", { name: "Edit this route" })).toBeFocused();
  await closest.getByRole("button", { name: "Edit this route" }).click();
  await closest.getByLabel("Route title").fill("Make complex work clear");
  await closest.getByRole("button", { name: "Save route changes" }).click();
  await expect(closest.getByRole("heading", { name: "Make complex work clear" })).toBeVisible();
  await expect(closest.getByText("Edited by you")).toBeVisible();

  await bridge.getByRole("button", { name: "Set this aside" }).click();
  await bridge.getByRole("button", { name: "Set aside this route" }).click();
  await expect(bridge.getByText("Set aside", { exact: true })).toBeVisible();

  await closest.getByRole("button", { name: "Choose this to test" }).click();
  await expect(page.getByRole("heading", { name: "You chose “Make complex work clear” to test" })).toBeVisible();
  await expect(page.getByText("Choosing saved this direction.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "You chose “Make complex work clear” to test" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("all-route rejection finishes without choosing a direction", async ({ page }) => {
  await completeJourneyToRoutes(page, SHAPES[1][0], SHAPES[1][1]);
  for (const kind of ["Closest", "Bridge", "Probe"]) {
    const card = routeCard(page, kind);
    await card.getByRole("button", { name: "Set this aside" }).click();
    await card.getByRole("button", { name: "Set aside this route" }).click();
  }
  await expect(page.getByRole("heading", { name: "You set all three routes aside" })).toBeVisible();
  await expect(page.getByText("No direction moved forward.")).toBeVisible();
});

test("keyboard flow, focus restoration, and screen-reader structure remain intact", async ({ page }) => {
  await page.getByRole("button", { name: "Start my journey" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "What shape does “stuck” have today?" })).toBeFocused();
  await page.getByLabel("I want to write it my way").focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Your words").fill("What kind of work helps me think clearly and help someone else?");
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();

  const snapshot = await page.locator("main").ariaSnapshot();
  expect(snapshot).toContain("heading");
  expect(snapshot).toContain("textbox \"Your words\"");
});

test("390px, 200% text size, reduced motion, and forced colors preserve the flow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.getByRole("button", { name: "Start my journey" }).click();
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
    transition: getComputedStyle(document.querySelector("button")!).transitionDuration,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
  expect(sizes.transition).toBe("0s");
  await expect(page.getByRole("heading", { name: "What shape does “stuck” have today?" })).toBeVisible();
});

async function completeJourneyToRoutes(page: Page, shape: string, firstAnswer: string, skipLast = false) {
  await page.getByRole("button", { name: "Start my journey" }).click();
  await page.getByLabel(shape).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await answerQuestion(page, firstAnswer);
  await answerQuestion(page, "I want to learn whether this kind of work gives me steady energy.");
  if (skipLast) {
    await page.getByRole("button", { name: "Skip for now" }).click();
  } else {
    await answerQuestion(page, "A free, private test that I can stop within a week would feel safe.");
  }

  if (!skipLast) await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Use these words" }).click();
  await page.getByRole("button", { name: "Build my three routes" }).click();
  await expect(page.getByRole("heading", { name: "Three directions. No winner picked for you." })).toBeVisible();
}

async function answerQuestion(page: Page, text: string) {
  await page.getByLabel("Your words").fill(text);
  await page.getByRole("button", { name: "Continue" }).click();
}

function routeCard(page: Page, kind: string) {
  return page.locator("article.route-card", { has: page.getByText(kind, { exact: true }) });
}

function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
