import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.beta.config";

const server = !Array.isArray(base.webServer) ? base.webServer : undefined;
export default defineConfig({
  ...base,
  projects: [
    {
      name: "dashboard-reliability",
      testMatch: /dashboard-(?:smoke|reliability)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: server
    ? {
        ...server,
        env: { ...server.env, ERROR_MONITORING_WEBHOOK_URL: "", ERROR_MONITORING_TOKEN: "" },
      }
    : undefined,
});
