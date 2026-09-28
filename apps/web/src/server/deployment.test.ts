import { describe, expect, it, vi } from "vitest";
import * as identityPolicy from "./identity/config";
import { allowsIdentitySandbox, productionConfigurationIssues } from "./deployment";
import { identityConfiguration } from "./identity/config";

describe("identity sandbox deployment guard", () => {
  const hosted = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://test:test@db.example.test/app",
    APP_URL: "https://beta.example.test",
    SESSION_SECRET: "s".repeat(32),
    MFA_ENCRYPTION_KEY: "configured",
    EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "fake-test-key",
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
  it("accepts intentionally disabled beta identity while retaining other production checks", () => {
    expect(
      productionConfigurationIssues({
        ...hosted,
        DEPLOYMENT_STAGE: "community_beta",
        IDENTITY_PROVIDER: "disabled",
      }),
    ).toEqual([]);
    expect(
      productionConfigurationIssues({
        ...hosted,
        DEPLOYMENT_STAGE: "community_beta",
        IDENTITY_PROVIDER: "disabled",
        RESEND_API_KEY: "",
      }),
    ).toContain("email_provider");
  });
  it("requires durable storage and valid scanner ports in hosted beta", () => {
    const beta = { ...hosted, DEPLOYMENT_STAGE: "community_beta", IDENTITY_PROVIDER: "disabled" };
    expect(
      productionConfigurationIssues({ ...beta, FILE_STORAGE_BACKEND: "filesystem" }),
    ).toContain("file_storage");
    expect(productionConfigurationIssues({ ...beta, SPACES_SECRET_ACCESS_KEY: "" })).toContain(
      "file_storage",
    );
    expect(
      productionConfigurationIssues({ ...beta, SPACES_ENDPOINT: "https://cdn.example.com" }),
    ).toContain("file_storage");
    expect(productionConfigurationIssues({ ...beta, CLAMAV_PORT: "65536" })).toContain(
      "malware_scanner",
    );
  });
  it("allows the explicit low-cost beta without upload providers, never full production", () => {
    const beta = {
      ...hosted,
      DEPLOYMENT_STAGE: "community_beta",
      IDENTITY_PROVIDER: "disabled",
      IDENTITY_SANDBOX_ENABLED: "0",
      FILE_UPLOADS_ENABLED: "false",
      FILE_SCANNER: undefined,
      CLAMAV_HOST: undefined,
      FILE_STORAGE_BACKEND: undefined,
      SPACES_SECRET_ACCESS_KEY: undefined,
    };
    expect(productionConfigurationIssues(beta)).toEqual([]);
    expect(productionConfigurationIssues({ ...beta, DEPLOYMENT_STAGE: "production" })).toEqual(
      expect.arrayContaining(["file_storage", "malware_scanner", "identity_provider"]),
    );
    for (const value of ["true", undefined, "FALSE", "typo"]) {
      expect(productionConfigurationIssues({ ...beta, FILE_UPLOADS_ENABLED: value })).toEqual(
        expect.arrayContaining(["file_storage", "malware_scanner"]),
      );
    }
    expect(productionConfigurationIssues({ ...beta, FILE_UPLOADS_ENABLED: "typo" })).toContain(
      "file_uploads_enabled",
    );
    expect(productionConfigurationIssues({ ...beta, IDENTITY_SANDBOX_ENABLED: "1" })).toContain(
      "file_storage",
    );
    expect(productionConfigurationIssues({ ...beta, RESEND_API_KEY: "" })).toContain(
      "email_provider",
    );
    expect(productionConfigurationIssues({ ...beta, CRON_SECRET: "" })).toContain("cron_secret");
  });
  it.each(["disabled", "sandbox", "", "unknown", "production"])(
    "rejects %s as a production identity provider",
    (provider) => {
      expect(
        productionConfigurationIssues({
          ...hosted,
          DEPLOYMENT_STAGE: "production",
          IDENTITY_PROVIDER: provider,
        }),
      ).toContain("identity_provider");
    },
  );
  it("never allows hosted-beta sandbox, even with local E2E flags", () => {
    const env = {
      ...hosted,
      DEPLOYMENT_STAGE: "community_beta",
      IDENTITY_PROVIDER: "sandbox",
      E2E_TEST_MODE: "1",
      IDENTITY_SANDBOX_ENABLED: "1",
      DATABASE_URL: "postgresql://test:test@127.0.0.1/app_test",
    };
    expect(allowsIdentitySandbox(env)).toBe(false);
    expect(productionConfigurationIssues(env)).toContain("identity_provider");
  });
  it("recognizes only implemented provider registrations, not arbitrary environment names", () => {
    const env = {
      ...hosted,
      DEPLOYMENT_STAGE: "production",
      IDENTITY_PROVIDER: "registered-test-adapter",
    };
    expect(identityConfiguration(env).real).toBe(false);
    // Policy contract for a future real adapter; this does not register an adapter in the application.
    expect(identityConfiguration(env, ["registered-test-adapter"]).real).toBe(true);
    expect(productionConfigurationIssues(env)).toContain("identity_provider");
    const original = identityPolicy.identityConfiguration;
    const registration = vi
      .spyOn(identityPolicy, "identityConfiguration")
      .mockImplementation((environment) => original(environment, ["registered-test-adapter"]));
    try {
      expect(productionConfigurationIssues(env)).toEqual([]);
    } finally {
      registration.mockRestore();
    }
  });
  it("rejects unknown stages and unknown providers in development too", () => {
    expect(
      productionConfigurationIssues({
        NODE_ENV: "development",
        DEPLOYMENT_STAGE: "typo",
        IDENTITY_PROVIDER: "typo",
      }),
    ).toEqual(["deployment_stage", "identity_provider"]);
  });
  it("allows an explicitly configured local sandbox", () => {
    expect(
      allowsIdentitySandbox({
        NODE_ENV: "development",
        IDENTITY_PROVIDER: "sandbox",
        DATABASE_URL: "postgresql://user:secret@127.0.0.1:5432/klaveroq",
      }),
    ).toBe(true);
  });

  it("denies non-sandbox providers and hosted databases", () => {
    expect(
      allowsIdentitySandbox({
        NODE_ENV: "development",
        IDENTITY_PROVIDER: "production",
        DATABASE_URL: "postgresql://user:secret@127.0.0.1:5432/klaveroq",
      }),
    ).toBe(false);
    expect(
      allowsIdentitySandbox({
        NODE_ENV: "development",
        IDENTITY_PROVIDER: "sandbox",
        DATABASE_URL: "postgresql://user:secret@db.example.com/klaveroq",
      }),
    ).toBe(false);
  });

  it("fails closed in hosted production, including when the sandbox flag is set", () => {
    expect(
      allowsIdentitySandbox({
        NODE_ENV: "production",
        IDENTITY_PROVIDER: "sandbox",
        IDENTITY_SANDBOX_ENABLED: "1",
        DATABASE_URL: "postgresql://user:secret@127.0.0.1:5432/klaveroq",
      }),
    ).toBe(false);
  });

  it("allows only the explicit disposable E2E production-build harness", () => {
    expect(
      allowsIdentitySandbox({
        NODE_ENV: "production",
        IDENTITY_PROVIDER: "sandbox",
        IDENTITY_SANDBOX_ENABLED: "1",
        E2E_TEST_MODE: "1",
        DATABASE_URL: "postgresql://user:secret@127.0.0.1:5432/klaveroq_test",
      }),
    ).toBe(true);
  });
});
