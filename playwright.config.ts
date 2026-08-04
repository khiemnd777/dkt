import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:41731",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "firefox-uat",
      testMatch: /uat\.spec\.ts/u,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-uat",
      testMatch: /uat\.spec\.ts/u,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome-uat",
      testMatch: /uat\.spec\.ts/u,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-safari-uat",
      testMatch: /uat\.spec\.ts/u,
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: "bun run dev -- --host 127.0.0.1 --port 41731 --strictPort",
    url: "http://127.0.0.1:41731/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
