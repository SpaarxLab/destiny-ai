import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./tests", testMatch: ["sting-chrome.spec.ts"], reporter: "line", timeout: 180_000, use: { trace: "retain-on-failure" } });
