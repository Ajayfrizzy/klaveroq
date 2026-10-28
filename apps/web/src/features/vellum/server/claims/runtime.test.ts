import { describe, expect, it } from "vitest";
import { runSettlementClaimIssuanceFromEnvironment } from "./runtime";

describe("Klaveroq settlement claim runtime", () => {
  it("does not enter the issuer workflow unless issuance is explicitly enabled", async () => {
    await expect(runSettlementClaimIssuanceFromEnvironment({})).resolves.toEqual({
      status: "disabled",
    });
    await expect(
      runSettlementClaimIssuanceFromEnvironment({
        KLAVEROQ_VELLUM_ISSUER_ENABLED: "0",
      }),
    ).resolves.toEqual({ status: "disabled" });
  });
});
