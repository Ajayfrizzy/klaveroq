import { describe, expect, it } from "vitest";
import { allowsIdentitySandbox } from "./deployment";

describe("identity sandbox deployment guard", () => {
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
