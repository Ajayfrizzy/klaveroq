import { describe, expect, it } from "vitest";
import { RETENTION_DAYS } from "./policy";

describe("data retention policy", () => {
  it("keeps security artifacts short-lived and regulated records long-lived", () => {
    expect(RETENTION_DAYS.walletChallenges).toBeLessThan(RETENTION_DAYS.expiredSessions);
    expect(RETENTION_DAYS.expiredSessions).toBeLessThan(RETENTION_DAYS.deliveredNotificationBodies);
    expect(RETENTION_DAYS.auditLogs).toBeGreaterThanOrEqual(365 * 7);
    expect(RETENTION_DAYS.financialAndAgreementRecords).toBeGreaterThanOrEqual(365 * 7);
  });
});
