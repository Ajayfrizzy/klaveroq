import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

process.env.TEST_DATABASE_URL ??= process.env.DATABASE_URL;

process.env.PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3201";

const server = !Array.isArray(base.webServer) ? base.webServer : undefined;
export default defineConfig({
  ...base,
  testIgnore: [],
  projects: [
    {
      name: "beta-identity",
      testMatch:
        /(?:authenticated-workspace|identity-beta|uploads-beta|dashboard-smoke|profile\.integration|marketplace\.integration)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  use: { ...base.use, baseURL: "http://127.0.0.1:3201" },
  webServer:
    process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1"
      ? undefined
      : {
          ...server,
          command: "npm run build && npx next start --hostname 127.0.0.1 --port 3201",
          url: "http://127.0.0.1:3201/login",
          timeout: 180_000,
          reuseExistingServer: false,
          env: {
            ...server?.env,
            NEXT_DIST_DIR: ".next-beta-e2e",
            APP_URL: "http://127.0.0.1:3201",
            CKB_NETWORK: "testnet",
            DEPLOYMENT_STAGE: "community_beta",
            IDENTITY_PROVIDER: "disabled",
            IDENTITY_SANDBOX_ENABLED: "0",
            FILE_UPLOADS_ENABLED: "false",
            FILE_SCANNER: "",
            FILE_STORAGE_BACKEND: "",
          },
        },
});
