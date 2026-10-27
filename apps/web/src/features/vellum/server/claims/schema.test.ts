import { describe, expect, it } from "vitest";
import {
  buildSettlementClaimPayload,
  parseSettlementClaimPayload,
  privateSettlementReference,
} from "./schema";

const ENGAGEMENT_ID = "11111111-1111-4111-8111-111111111111";
const MILESTONE_ID = "22222222-2222-4222-8222-222222222222";
const DELIVERY_ID = "33333333-3333-4333-8333-333333333333";
const TRANSACTION_HASH = `0x${"ab".repeat(32)}`;

describe("Klaveroq settlement claim payload", () => {
  it("derives stable field-separated references and a canonical payload", () => {
    expect(privateSettlementReference("engagement", ENGAGEMENT_ID)).toBe(
      "0xfb812d1865360153d0382359835fc8fee30d3924825c41d5b00078188402a2b7",
    );
    expect(privateSettlementReference("milestone", MILESTONE_ID)).toBe(
      "0xe85b813c3d4ec5c13d3876157be05ada4ce9d2d9197ac32522a31df759f88685",
    );
    expect(privateSettlementReference("delivery", DELIVERY_ID)).toBe(
      "0x4b89fedfb51f94e7665f57d5c1925160511ceb805982e54b7a5f75644ecb8449",
    );

    const payload = buildSettlementClaimPayload({
      approvalMethod: "client",
      deliveryId: DELIVERY_ID,
      engagementId: ENGAGEMENT_ID,
      milestoneId: MILESTONE_ID,
      milestoneSequence: 2,
      settledAt: 2_000_000_000,
      settlementTransactionHash: TRANSACTION_HASH.toUpperCase().replace("0X", "0x"),
    });
    expect(parseSettlementClaimPayload(payload)).toEqual(payload);
    expect(payload).not.toHaveProperty("amount");
    expect(payload).not.toHaveProperty("title");
    expect(payload.settlement_tx_hash).toBe(TRANSACTION_HASH);
  });

  it("rejects invalid private IDs and noncanonical payloads", () => {
    expect(() => privateSettlementReference("milestone", "not-a-uuid")).toThrow();
    const valid = buildSettlementClaimPayload({
      approvalMethod: "review_timeout",
      deliveryId: DELIVERY_ID,
      engagementId: ENGAGEMENT_ID,
      milestoneId: MILESTONE_ID,
      milestoneSequence: 1,
      settledAt: 2_000_000_000,
      settlementTransactionHash: TRANSACTION_HASH,
    });
    expect(() => parseSettlementClaimPayload({ ...valid, amount: "100" })).toThrow();
    expect(() => parseSettlementClaimPayload({ ...valid, milestone_sequence: 0 })).toThrow();
    expect(() => parseSettlementClaimPayload({ ...valid, approval_method: "admin" })).toThrow();
    expect(() =>
      parseSettlementClaimPayload({
        ...valid,
        settlement_tx_hash: TRANSACTION_HASH.toUpperCase().replace("0X", "0x"),
      }),
    ).toThrow();
  });
});
