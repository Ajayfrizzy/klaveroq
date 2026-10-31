import { describe, expect, it } from "vitest";
import { registerSchema, resetPasswordSchema } from "@/server/auth/schemas";
import { PASSWORD_PATTERN } from "./password-policy";

describe("new password policy", () => {
  it.each([
    ["Short123", false],
    ["alllowercase123", false],
    ["ALLUPPERCASE123", false],
    ["NoNumbersHere", false],
    ["StrongPass12", true],
    ["Strong Pass12!", true],
    ["A1" + "a".repeat(126), true],
    ["A1" + "a".repeat(127), false],
  ])("keeps registration, reset and browser requirements aligned for %s", (password, valid) => {
    expect(
      registerSchema.safeParse({ email: "test@example.com", displayName: "Test", password })
        .success,
    ).toBe(valid);
    expect(resetPasswordSchema.safeParse({ token: "t".repeat(32), password }).success).toBe(valid);
    expect(new RegExp(`^(?:${PASSWORD_PATTERN})$`, "v").test(password)).toBe(valid);
  });
});
