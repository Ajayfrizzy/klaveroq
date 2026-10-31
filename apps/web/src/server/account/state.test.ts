import { describe, expect, it } from "vitest";
import { accountCanAuthenticate, recoveryOpen } from "./state";
import { googleAccountAction } from "../auth/google";
describe("account entry points", () => {
  it.each([
    "PENDING_DELETION",
    "SUSPENDED",
    "SECURITY_REVIEW",
    "RESTRICTED",
    "CLOSED",
    "CLOSED_RETAINED",
    "ANONYMIZED",
  ])("blocks %s from password/session and Google authentication", (status) => {
    expect(accountCanAuthenticate(status)).toBe(false);
    expect(
      googleAccountAction({ linked: true, linkedStatus: status, emailOwnerExists: true }),
    ).toBe("unavailable");
  });
  it("closes recovery exactly at its deadline", () => {
    const deadline = new Date("2026-11-30T12:00:00Z");
    expect(recoveryOpen(deadline, new Date(deadline.getTime() - 1))).toBe(true);
    expect(recoveryOpen(deadline, deadline)).toBe(false);
    expect(recoveryOpen(deadline, new Date(deadline.getTime() + 1))).toBe(false);
  });
});
