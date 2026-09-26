import { describe, expect, it } from "vitest";
import { preferenceAllowsEmail, retryDelayMs } from "./policy";

const preferences = {
  proposalEmails: false,
  messageEmails: true,
  jobEmails: false,
  disputeEmails: true,
  supportEmails: false,
};

describe("notification delivery policy", () => {
  it("applies optional category preferences without suppressing security email", () => {
    expect(preferenceAllowsEmail("PROPOSAL", preferences)).toBe(false);
    expect(preferenceAllowsEmail("MESSAGE", preferences)).toBe(true);
    expect(preferenceAllowsEmail("JOB", preferences)).toBe(false);
    expect(preferenceAllowsEmail("DISPUTE", preferences)).toBe(true);
    expect(preferenceAllowsEmail("SUPPORT", preferences)).toBe(false);
    expect(preferenceAllowsEmail("SECURITY", preferences)).toBe(true);
    expect(preferenceAllowsEmail("PROPOSAL", null)).toBe(true);
  });

  it("backs delivery retries off and caps the delay at one day", () => {
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(2)).toBe(120_000);
    expect(retryDelayMs(20)).toBe(24 * 60 * 60 * 1000);
  });
});
