import { defineConfig, devices } from "@playwright/test";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3199",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /responsive\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    { name: "mobile", testMatch: /responsive\.spec\.ts/, use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run build && npx next start --hostname 127.0.0.1 --port 3199",
    url: "http://127.0.0.1:3199/login",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: databaseUrl,
      APP_URL: "http://127.0.0.1:3199",
      NEXT_DIST_DIR: ".next-e2e",
      SESSION_COOKIE_NAME: "klaveroq_test_session",
      KLAVEROQ_ALLOW_LOCAL_SEED: "",
      KLAVEROQ_PREVIEW_MODE: "",
    },
  },
});
