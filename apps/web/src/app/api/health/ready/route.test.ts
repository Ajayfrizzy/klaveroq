import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/server/db", () => ({ db: { execute: vi.fn().mockResolvedValue([]) } }));
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());
describe("hosted identity readiness", () => {
  it("reports upload infrastructure as intentionally not required in disabled-upload beta", async () => {
    const env = {
      NODE_ENV: "production",
      DEPLOYMENT_STAGE: "community_beta",
      IDENTITY_PROVIDER: "disabled",
      IDENTITY_SANDBOX_ENABLED: "0",
      FILE_UPLOADS_ENABLED: "false",
      E2E_TEST_MODE: "0",
      DATABASE_URL: "postgresql://test:test@db.example.test/app",
      APP_URL: "https://beta.example.test",
      SESSION_SECRET: "s".repeat(32),
      MFA_ENCRYPTION_KEY: "configured",
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "fake",
      EMAIL_FROM: "Klaveroq <accounts@example.test>",
      RESEND_WEBHOOK_SECRET: "whsec_test",
      CRON_SECRET: "c".repeat(32),
      FILE_SCANNER: "",
      CLAMAV_HOST: "",
      FILE_STORAGE_BACKEND: "",
    };
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).dependencies).toMatchObject({
      fileUploads: "disabled",
      fileStorage: "not_required_uploads_disabled",
      fileScanner: "not_required_uploads_disabled",
    });
  });
  it.each(["community_beta", "production"])(
    "reports the correct readiness for %s with identity disabled",
    async (stage) => {
      const env = {
        NODE_ENV: "production",
        DEPLOYMENT_STAGE: stage,
        IDENTITY_PROVIDER: "disabled",
        E2E_TEST_MODE: "0",
        DATABASE_URL: "postgresql://test:test@db.example.test/app",
        APP_URL: "https://beta.example.test",
        SESSION_SECRET: "s".repeat(32),
        MFA_ENCRYPTION_KEY: "configured",
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "fake",
        EMAIL_FROM: "Klaveroq <accounts@example.test>",
        RESEND_WEBHOOK_SECRET: "whsec_test",
        FILE_SCANNER: "clamav",
        CLAMAV_HOST: "scanner",
        FILE_STORAGE_BACKEND: "spaces",
        SPACES_REGION: "ams3",
        SPACES_ENDPOINT: "https://ams3.digitaloceanspaces.com",
        SPACES_BUCKET: "test-beta",
        SPACES_PREFIX: "community-beta/",
        SPACES_ACCESS_KEY_ID: "mock-key",
        SPACES_SECRET_ACCESS_KEY: "mock-secret",
        CRON_SECRET: "c".repeat(32),
      };
      for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
      const response = await GET();
      const body = await response.json();
      expect(response.status).toBe(stage === "community_beta" ? 200 : 503);
      if (stage === "community_beta")
        expect(body.dependencies.identity).toBe("intentionally_disabled_for_beta");
      else expect(body.configurationIssues).toContain("identity_provider");
    },
  );
});
