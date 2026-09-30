import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e", timeout: 60000, expect: { timeout: 15000 }, workers: 1,
  use: { baseURL: process.env.SAVE_TEST_URL || "http://127.0.0.1:5174", trace: "retain-on-failure" },
  webServer: process.env.SAVE_TEST_URL ? undefined : { command: "npm run dev -- --host 127.0.0.1 --port 5174 --strictPort", url: "http://127.0.0.1:5174", env: { PLAYWRIGHT_TEST: "1" } },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
