import { chromium, expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Real Chrome (149+) with chrome://flags/#enable-webmcp-testing on, driving a production server through
 * document.modelContext itself: getTools, executeTool, toolchange. Start the server first: `npm run build -- --webpack && npx next start -p 3111`.
 * Run: `npm run test:chrome`. Override the target with STING_BASE_URL. Needs Google Chrome installed;
 * the flag is set through the profile's Local State file.
 */
test("real Chrome: the catalogue rotates, a tool call stamps a passport, a miss shrinks the catalogue", async () => {
  test.setTimeout(180_000);
  const baseUrl = process.env.STING_BASE_URL ?? "http://127.0.0.1:3111";
  const profile = join(process.cwd(), ".chrome-profile");
  mkdirSync(profile, { recursive: true });
  writeFileSync(join(profile, "Local State"), JSON.stringify({ browser: { enabled_labs_experiments: ["enable-webmcp-testing@1"] } }));
  const context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: false, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const log: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" || message.type() === "warning") log.push(message.text()); });
  await page.goto(baseUrl);
  // The persistent profile keeps the last room; start clean.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1500);
  const has = await page.evaluate(() => typeof (document as unknown as { modelContext?: unknown }).modelContext);
  console.log("document.modelContext:", has);
  expect(has).toBe("object");
  const names = async () => page.evaluate(async () => (await (document as unknown as { modelContext: { getTools(): Promise<{ name: string; title?: string; annotations?: unknown }[]> } }).modelContext.getTools()).map((tool) => tool.name));
  const call = async (tool: string, input: unknown) => page.evaluate(async ({ tool, input }) => {
    const mc = (document as unknown as { modelContext: { getTools(): Promise<{ name: string }[]>; executeTool(tool: { name: string }, input: string): Promise<string> } }).modelContext;
    const registered = (await mc.getTools()).find((item) => item.name === tool);
    if (!registered) throw new Error(`${tool} is not in the catalogue right now`);
    const raw = await mc.executeTool(registered, JSON.stringify(input));
    try { return JSON.parse(raw); } catch { return raw; }
  }, { tool, input });

  console.log("door:", await names());
  expect(await names()).toEqual(["inspect_room"]);
  // A read at the door marks the page as agent-driven, so Spark stands down and the catalogue waits for us.
  const door = await call("inspect_room", { view: "trust" });
  console.log("door trust:", door.summary, "| tiers:", door.tiers?.length);
  await page.screenshot({ path: "test-results/chrome-door.png", animations: "disabled" });
  await page.evaluate(() => { (window as unknown as { __changes: number }).__changes = 0; (document as unknown as { modelContext: EventTarget }).modelContext.addEventListener("toolchange", () => { (window as unknown as { __changes: number }).__changes += 1; }); });
  await page.getByRole("button", { name: "Play" }).click();
  await page.waitForTimeout(1200);
  const atCast = await names();
  console.log("cast:", atCast);
  expect(atCast).toContain("stage_cast");
  const tools = await page.evaluate(async () => (await (document as unknown as { modelContext: { getTools(): Promise<{ name: string; title?: string; description: string; annotations?: Record<string, unknown> }[]> } }).modelContext.getTools()).map((tool) => ({ name: tool.name, title: tool.title, len: tool.description.length, annotations: tool.annotations })));
  console.log(JSON.stringify(tools));

  const room = await call("inspect_room", {});
  console.log("inspect_room summary:", room.summary, "| tier:", room.standing?.tier, "| next:", room.validNextAgentMove);
  const lives = [
    { line: "A product users beg you to keep building.", scene: "desk", axis: "autonomy_belonging", pole: "b" },
    { line: "One instrument, ten years, finally effortless.", scene: "stage", axis: "depth_breadth", pole: "a" },
    { line: "Sunday lunch, three people need you there.", scene: "kitchen", axis: "people_things", pole: "a" },
    { line: "A silent walk, phone left on the desk.", scene: "road", axis: "autonomy_belonging", pole: "a" },
    { line: "Five small projects, each opening another door.", scene: "workshop", axis: "depth_breadth", pole: "b" },
    { line: "Ship the strange product before anyone agrees.", scene: "office", axis: "stability_risk", pole: "b" },
    { line: "Hands dusty, the chair finally holds.", scene: "workshop", axis: "making_deciding", pole: "a" },
    { line: "At midnight, you fix what nobody saw.", scene: "server", axis: "visible_hidden", pole: "b" },
  ];
  const cast = await call("stage_cast", { operationId: `chrome-cast-${Date.now()}`, expectedVersion: room.stateVersion, lives });
  console.log("stage_cast:", cast.summary, "| via:", cast.room?.player?.via);
  expect(cast.ok).toBe(true);
  expect(cast.room.player.via).toMatch(/Chrome \d+/);
  await page.waitForTimeout(800);
  console.log("after cast:", await names());
  const posters = page.locator(".sting-grid .poster");
  await expect(posters).toHaveCount(8);
  await page.screenshot({ path: "test-results/chrome-after-cast.png", animations: "disabled" });
  await posters.nth(0).click(); await posters.nth(3).click(); await posters.nth(5).click();
  await page.waitForTimeout(1200);
  const beforeCold = await names();
  console.log("before cold read:", beforeCold);
  expect(beforeCold).not.toContain("stage_duel");
  expect(beforeCold).not.toContain("ask_once");
  expect(beforeCold).toContain("propose_hypothesis");
  const roomBeforeCold = await call("inspect_room", {});
  expect(roomBeforeCold.validNextAgentMove).toBe("propose_hypothesis kind cold_read");
  const cold = await call("propose_hypothesis", { operationId: `chrome-cold-${Date.now()}`, expectedVersion: roomBeforeCold.stateVersion, kind: "cold_read", text: "You want a room that still needs you." });
  expect(cold.ok).toBe(true);
  await page.waitForTimeout(800);
  const atDuel = await names();
  console.log("after cold read:", atDuel);
  expect(atDuel).toContain("stage_duel");
  expect(atDuel).toContain("ask_once");
  const room2 = await call("inspect_room", {});
  const duel = await call("stage_duel", { operationId: `chrome-duel-${Date.now()}`, expectedVersion: room2.stateVersion, testsLifeRef: room2.lives[0].ref, axis: "autonomy_belonging", variable: "alone or reachable", a: { line: "Yours alone. Nobody to call.", scene: "beach" }, b: { line: "Shared. Three people can call you.", scene: "office" }, bet: { pick: "b", chips: 2, because: "You tapped the quiet one slowly." } });
  console.log("stage_duel:", duel.summary, "| commitment:", duel.commitment);
  expect(duel.ok).toBe(true);
  await page.waitForTimeout(800);
  const sealed = await call("inspect_room", {});
  expect(JSON.stringify(sealed)).not.toContain("quiet one slowly");
  console.log("bet hidden while open:", !JSON.stringify(sealed).includes("quiet one slowly"));
  await page.screenshot({ path: "test-results/chrome-duel-sealed.png" });
  // The person taps the other side: a miss. The catalogue must lose stage_duel until a revision lands.
  await page.locator(".duel .poster").nth(0).click();
  await page.waitForTimeout(1500);
  const afterMiss = await names();
  console.log("after miss:", afterMiss);
  expect(afterMiss).not.toContain("stage_duel");
  const stale = await call("stage_duel", { operationId: `chrome-stale-${Date.now()}`, expectedVersion: 0, testsLifeRef: "x", axis: "autonomy_belonging", variable: "v", a: { line: "A", scene: "desk" }, b: { line: "B", scene: "desk" }, bet: { pick: "a", chips: 1, because: "x" } }).catch((error: Error) => ({ error: error.message }));
  console.log("stale call:", JSON.stringify(stale).slice(0, 200));
  const revealed = await call("inspect_room", {});
  console.log("revealed bet:", JSON.stringify(revealed.duels[0].bet), "| outcome:", revealed.duels[0].outcome);
  expect(revealed.duels[0].outcome).toBe("miss");
  const revision = await call("propose_hypothesis", { operationId: `chrome-rev-${Date.now()}`, expectedVersion: revealed.stateVersion, kind: "revision", text: "You want the quiet more than the company.", revises: revealed.duels[0].reactionRef, correction: "I misread you: the quiet won." });
  console.log("revision:", revision.summary);
  await page.waitForTimeout(1200);
  const afterRevision = await names();
  console.log("after revision:", afterRevision);
  expect(afterRevision).toContain("stage_duel");
  await page.screenshot({ path: "test-results/chrome-after-revision.png" });
  const changes = await page.evaluate(() => (window as unknown as { __changes: number }).__changes);
  console.log("toolchange events:", changes);
  expect(changes).toBeGreaterThanOrEqual(3);
  console.log("console errors:", JSON.stringify(log.filter((text) => !text.includes("React DevTools"))));
  await context.close();
});
