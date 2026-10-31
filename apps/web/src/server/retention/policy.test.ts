import { describe, expect, it } from "vitest";
import { RETENTION_DAYS, REVIEW_REQUIRED_RECORDS } from "./policy";

describe("data retention policy", () => {
  it("keeps security artifacts short-lived and requires review of historical evidence", () => {
    expect(RETENTION_DAYS.walletChallenges).toBeLessThan(RETENTION_DAYS.expiredSessions);
    expect(RETENTION_DAYS.expiredSessions).toBeLessThan(RETENTION_DAYS.deliveredNotificationBodies);
    expect(REVIEW_REQUIRED_RECORDS).toEqual(["audit_logs", "agreements", "financial_records"]);
  });
});
