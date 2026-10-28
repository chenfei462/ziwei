import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 2,
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:43117",
    trace: "retain-on-failure",
    extraHTTPHeaders: {
      "x-admin-token": "phase10_admin_token",
      "x-admin-role": "ops_admin",
      "x-admin-actor": "playwright_e2e"
    }
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 980 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ]
});
