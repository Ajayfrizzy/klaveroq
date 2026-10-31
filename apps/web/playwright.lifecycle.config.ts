import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
const server = base.webServer;
if (!server || Array.isArray(server))
  throw new Error("Lifecycle tests require their own isolated server.");
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: /account-lifecycle\.spec\.ts/,
  projects: [{ name: "lifecycle-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    ...server,
    env: {
      ...server.env,
      ACCOUNT_CLEANUP_ENABLED: "true",
      FILE_UPLOADS_ENABLED: "false",
      IDENTITY_PROVIDER: "disabled",
      IDENTITY_SANDBOX_ENABLED: "0",
      DEPLOYMENT_STAGE: "community_beta",
    },
  },
});
