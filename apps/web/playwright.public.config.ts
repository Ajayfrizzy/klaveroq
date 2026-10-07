import { defineConfig, devices } from "@playwright/test";
import beta from "./playwright.beta.config";

// Reuse the validated isolated URL for tests that query PostgreSQL directly.
process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;

export default defineConfig({
  ...beta,
  projects: [
    {
      name: "public-marketplace",
      testMatch:
        /(?:auth|preferences|public-marketplace|profile\.integration|marketplace\.integration|dashboard-smoke|uploads-beta|identity-beta)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
