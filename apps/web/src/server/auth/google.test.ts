import { describe, expect, it } from "vitest";
import {
  googleAccountAction,
  googleOAuthHref,
  safeReturnTo,
  validOAuthTransaction,
} from "./google";

describe("safeReturnTo", () => {
  it("keeps local paths and query strings", () => {
    expect(safeReturnTo("/jobs?view=proposals")).toBe("/jobs?view=proposals");
  });

  it.each([undefined, null, "", "https://evil.test", "//evil.test", "javascript:alert(1)"])(
    "rejects unsafe destination %s",
    (value) => expect(safeReturnTo(value)).toBe("/"),
  );
});

describe("Google OAuth security decisions", () => {
  it("builds the existing initiation route with a safe destination", () => {
    expect(googleOAuthHref("/jobs?view=proposals")).toBe(
      "/api/auth/google?returnTo=%2Fjobs%3Fview%3Dproposals",
    );
    expect(googleOAuthHref("//evil.test")).toBe("/api/auth/google?returnTo=%2F");
  });

  it("rejects missing or mismatched state and nonce material", () => {
    const valid = {
      code: "code",
      state: "state",
      expectedState: "state",
      nonce: "nonce",
      verifier: "verifier",
    };
    expect(validOAuthTransaction(valid)).toBe(true);
    expect(validOAuthTransaction({ ...valid, state: "wrong" })).toBe(false);
    expect(validOAuthTransaction({ ...valid, nonce: undefined })).toBe(false);
  });

  it("creates, repeats, conflicts, and blocks suspended accounts safely", () => {
    expect(googleAccountAction({ linked: false, emailOwnerExists: false })).toBe("create");
    expect(
      googleAccountAction({ linked: true, linkedStatus: "ACTIVE", emailOwnerExists: true }),
    ).toBe("login");
    expect(googleAccountAction({ linked: false, emailOwnerExists: true })).toBe("conflict");
    expect(
      googleAccountAction({ linked: true, linkedStatus: "SUSPENDED", emailOwnerExists: true }),
    ).toBe("unavailable");
  });
});
