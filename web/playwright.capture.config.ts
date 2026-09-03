import { defineConfig, devices } from "@playwright/test";

/**
 * Re-captures the deterministic STING door, cast, and sealed card against an
 * already-running current build. Run `npm run build -- --webpack`, then start
 * `STING_PLAYER=off npm run start -- -p 3113`, then run `npm run capture:demo`.
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: ["sting.spec.ts"],
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  timeout: 150_000,
  use: {
    baseURL: process.env.STING_CAPTURE_URL ?? "http://127.0.0.1:3113",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
