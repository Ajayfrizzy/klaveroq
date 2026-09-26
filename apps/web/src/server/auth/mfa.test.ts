import { describe, expect, it } from "vitest";
import { base32Encode, decryptMfaSecret, encryptMfaSecret, totpCode, verifyTotp } from "./mfa";

describe("TOTP MFA", () => {
  it("matches the RFC 6238 SHA-1 vectors after truncation", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect(totpCode(secret, 59_000)).toBe("287082");
    expect(verifyTotp(secret, "287082", 59_000)).toBe(true);
    expect(verifyTotp(secret, "000000", 59_000)).toBe(false);
  });

  it("encrypts secrets with authenticated encryption", () => {
    const encrypted = encryptMfaSecret("JBSWY3DPEHPK3PXP");
    expect(encrypted).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptMfaSecret(encrypted)).toBe("JBSWY3DPEHPK3PXP");
  });
});
