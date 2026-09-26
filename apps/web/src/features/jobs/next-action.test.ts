import { describe, expect, it } from "vitest";
import { agreementNextAction } from "./next-action";

describe("agreement guidance", () => {
  it("never asks workers to begin before funding is confirmed", () => {
    for (const status of ["INVITED", "AWAITING_FUNDING"]) {
      expect(agreementNextAction(status, "worker", ["ACTIVE"]).detail).toContain(
        "not ready for work",
      );
    }
  });
  it("routes review and revision to the responsible participant", () => {
    expect(agreementNextAction("IN_PROGRESS", "client", ["PROOF_SUBMITTED"]).title).toBe(
      "Review milestone proof",
    );
    expect(agreementNextAction("IN_PROGRESS", "worker", ["REVISION_REQUESTED"]).title).toBe(
      "Submit your revised work",
    );
    expect(agreementNextAction("IN_PROGRESS", "client", ["ACTIVE"]).title).toBe("Work is underway");
  });
  it("prioritizes holds and terminal states over stale milestone actions", () => {
    expect(agreementNextAction("SECURITY_HOLD", "worker", ["REVISION_REQUESTED"]).title).toContain(
      "on hold",
    );
    expect(agreementNextAction("COMPLETED", "client", ["PROOF_SUBMITTED"]).title).toBe(
      "Share a review",
    );
    expect(agreementNextAction("CANCELLED", "worker", ["ACTIVE"]).title).toBe(
      "Review agreement history",
    );
  });
});
