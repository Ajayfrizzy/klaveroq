import { describe, expect, it } from "vitest";
import {
  KLAVEROQ_MILESTONE_SETTLEMENT_SCHEMA_HASH,
  KLAVEROQ_MILESTONE_SETTLEMENT_SCHEMA_ID,
  settlementClaimConfiguration,
  SettlementClaimConfigurationError,
} from "./config";

const ISSUER_DID = "did:ckb:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PRIVATE_KEY = `0x${"AB".repeat(32)}`;

const enabled = {
  CKB_NETWORK: "testnet",
  CKB_RPC_URL: "https://testnet.ckb.dev",
  KLAVEROQ_VELLUM_ISSUER_ENABLED: "1",
  KLAVEROQ_VELLUM_ISSUER_DID: ISSUER_DID,
  KLAVEROQ_VELLUM_ISSUER_CKB_PRIVATE_KEY: PRIVATE_KEY,
  KLAVEROQ_VELLUM_MIN_CONFIRMATIONS: "6",
};

describe("Klaveroq Vellum claim configuration", () => {
  it("is disabled unless explicitly enabled", () => {
    expect(settlementClaimConfiguration({})).toEqual({ enabled: false });
    expect(settlementClaimConfiguration({ KLAVEROQ_VELLUM_ISSUER_ENABLED: "0" })).toEqual({
      enabled: false,
    });
  });

  it("loads only the Klaveroq-specific Testnet issuer settings", () => {
    expect(settlementClaimConfiguration(enabled)).toEqual({
      enabled: true,
      issuerDid: ISSUER_DID,
      issuerPrivateKey: PRIVATE_KEY.toLowerCase(),
      minimumConfirmations: 6,
    });
    expect(KLAVEROQ_MILESTONE_SETTLEMENT_SCHEMA_ID).toBe("klaveroq.milestone-settlement.v1");
    expect(KLAVEROQ_MILESTONE_SETTLEMENT_SCHEMA_HASH).toBe(
      "0x899820258835146d1de40525b120f67b24bd0e390bb0d3aba258460d524c8473",
    );
  });

  it("fails closed for partial, malformed, or renamed configuration", () => {
    for (const environment of [
      { ...enabled, CKB_NETWORK: "mainnet" },
      { ...enabled, KLAVEROQ_VELLUM_ISSUER_DID: "" },
      { ...enabled, KLAVEROQ_VELLUM_ISSUER_CKB_PRIVATE_KEY: "" },
      { ...enabled, KLAVEROQ_VELLUM_MIN_CONFIRMATIONS: "0" },
      { ...enabled, KLAVEROQ_VELLUM_MIN_CONFIRMATIONS: "101" },
      { ...enabled, KLAVEROQ_VELLUM_ISSUER_ENABLED: "true" },
      {
        CKB_NETWORK: "testnet",
        KLAVEROQ_VELLUM_ISSUER_ENABLED: "1",
        VELLUM_ISSUER_DID: ISSUER_DID,
        VELLUM_ISSUER_PRIVATE_KEY: PRIVATE_KEY,
        KLAVEROQ_VELLUM_MIN_CONFIRMATIONS: "6",
      },
    ]) {
      expect(() => settlementClaimConfiguration(environment)).toThrow(
        SettlementClaimConfigurationError,
      );
    }
  });
});
