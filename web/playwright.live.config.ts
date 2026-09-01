import { defineConfig } from "@playwright/test";

/**
 * Live WebMCP proof against REAL Google Chrome with the `enable-webmcp-testing` flag persisted in
 * a throwaway profile. Run with: `npx playwright test -c playwright.live.config.ts`.
 * This is browser-runtime proof, not ChatGPT in-app-browser proof.
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: "webmcp-live.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  timeout: 120_000,
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3101",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
