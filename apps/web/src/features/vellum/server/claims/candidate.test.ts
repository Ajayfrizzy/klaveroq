import { describe, expect, it } from "vitest";
import { approvalMatchesOperation } from "./candidate";

const PROOF_ID = "33333333-3333-4333-8333-333333333333";

describe("Klaveroq settlement approval provenance", () => {
  it("matches direct approval only to the reviewed proof", () => {
    expect(
      approvalMatchesOperation(
        { proofId: PROOF_ID },
        { automatic: false, proofSubmissionId: PROOF_ID },
      ),
    ).toBe(true);
    expect(
      approvalMatchesOperation(
        { proofId: "44444444-4444-4444-8444-444444444444" },
        { automatic: false, proofSubmissionId: PROOF_ID },
      ),
    ).toBe(false);
  });

  it("requires the operation and review to agree on timeout approval", () => {
    expect(
      approvalMatchesOperation(
        { automatic: true, proofId: PROOF_ID },
        { automatic: true, proofSubmissionId: PROOF_ID },
      ),
    ).toBe(true);
    expect(
      approvalMatchesOperation(
        { automatic: true, proofId: PROOF_ID },
        { automatic: false, proofSubmissionId: PROOF_ID },
      ),
    ).toBe(false);
    expect(
      approvalMatchesOperation(
        { automatic: true, proofId: "44444444-4444-4444-8444-444444444444" },
        { automatic: true, proofSubmissionId: PROOF_ID },
      ),
    ).toBe(false);
    expect(
      approvalMatchesOperation(undefined, {
        automatic: true,
        proofSubmissionId: PROOF_ID,
      }),
    ).toBe(false);
  });
});
