import { ccc } from "@ckb-ccc/core";
import { isDidCkb } from "@ckb-ccc/did-ckb";
import type { ClaimScriptConfigLike } from "@usevellum/sdk";

export const KLAVEROQ_MILESTONE_SETTLEMENT_SCHEMA_ID = "klaveroq.milestone-settlement.v1" as const;
export const KLAVEROQ_MILESTONE_SETTLEMENT_SCHEMA_HASH =
  "0x899820258835146d1de40525b120f67b24bd0e390bb0d3aba258460d524c8473" as const;

const CLAIM_DEPLOYMENT_TX = "0xaf693346282063a5d51f79d180fc807cdba1b8ac9d7af30085ff0aa190e2686c";
const PRIVATE_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function scriptInfo(codeHash: ccc.Hex, index: number): ccc.ScriptInfoLike {
  return {
    codeHash,
    hashType: "type",
    cellDeps: [
      {
        cellDep: {
          outPoint: { txHash: CLAIM_DEPLOYMENT_TX, index },
          depType: "code",
        },
      },
    ],
  };
}

export const claimScripts = {
  claimType: scriptInfo("0xfb2757e524b3f83161d8b85b8b3e00186e2019ff04f5dfe833c5a72731e13157", 0),
  didLock: scriptInfo("0xe1562cc57b4bd91619ada2f7e74d63805ea7038a7b6de0b18a529d51aa883d2d", 1),
} satisfies ClaimScriptConfigLike;

export type SettlementClaimEnvironment = Record<string, string | undefined>;

export type SettlementClaimConfiguration =
  | { enabled: false }
  | {
      enabled: true;
      issuerDid: string;
      issuerPrivateKey: ccc.Hex;
      minimumConfirmations: number;
    };

export class SettlementClaimConfigurationError extends Error {}

export function settlementClaimConfiguration(
  environment: SettlementClaimEnvironment = process.env,
): SettlementClaimConfiguration {
  const enabled = environment.KLAVEROQ_VELLUM_ISSUER_ENABLED?.trim();
  if (!enabled || enabled === "0") return { enabled: false };
  if (enabled !== "1") {
    throw new SettlementClaimConfigurationError(
      "KLAVEROQ_VELLUM_ISSUER_ENABLED must be either 0 or 1.",
    );
  }
  if (environment.CKB_NETWORK !== "testnet") {
    throw new SettlementClaimConfigurationError(
      "Klaveroq Vellum claims are available on CKB Testnet only.",
    );
  }

  const issuerDid = environment.KLAVEROQ_VELLUM_ISSUER_DID?.trim();
  if (!issuerDid || !isDidCkb(issuerDid)) {
    throw new SettlementClaimConfigurationError(
      "The Klaveroq Vellum issuer DID is not configured.",
    );
  }
  const privateKey = environment.KLAVEROQ_VELLUM_ISSUER_CKB_PRIVATE_KEY?.trim();
  if (!privateKey || !PRIVATE_KEY_PATTERN.test(privateKey)) {
    throw new SettlementClaimConfigurationError(
      "The Klaveroq Vellum issuer credential is not configured.",
    );
  }
  const confirmationText = environment.KLAVEROQ_VELLUM_MIN_CONFIRMATIONS?.trim();
  if (!confirmationText || !/^[1-9][0-9]{0,2}$/.test(confirmationText)) {
    throw new SettlementClaimConfigurationError(
      "KLAVEROQ_VELLUM_MIN_CONFIRMATIONS must be an integer from 1 through 100.",
    );
  }
  const minimumConfirmations = Number(confirmationText);
  if (minimumConfirmations > 100) {
    throw new SettlementClaimConfigurationError(
      "KLAVEROQ_VELLUM_MIN_CONFIRMATIONS must be an integer from 1 through 100.",
    );
  }

  return {
    enabled: true,
    issuerDid,
    issuerPrivateKey: privateKey.toLowerCase() as ccc.Hex,
    minimumConfirmations,
  };
}
