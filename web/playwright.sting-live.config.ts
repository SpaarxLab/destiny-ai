import { defineConfig, devices } from "@playwright/test";

/** Drives a running production server with the Spark player ON. Start it first: `npx next start -p 3111`. */
export default defineConfig({
  testDir: "./tests",
  testMatch: ["sting-live.spec.ts"],
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  timeout: 240_000,
  use: { baseURL: "http://127.0.0.1:3111", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
