import { defineConfig, devices } from "@playwright/test";
import beta from "./playwright.beta.config";

process.env.TEST_DATABASE_URL ??= process.env.DATABASE_URL;

export default defineConfig({
  ...beta,
  projects: [
    {
      name: "authenticated-workspace",
      testMatch: /(?:authenticated-workspace|identity-beta|uploads-beta)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
