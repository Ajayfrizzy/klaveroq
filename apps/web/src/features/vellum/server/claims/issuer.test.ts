import { ccc } from "@ckb-ccc/core";
import type { WriteClaimResult } from "@usevellum/sdk";
import { describe, expect, it, vi } from "vitest";
import type { VellumSettlementClaimPayload } from "@/server/db/schema";
import {
  claimScripts,
  KLAVEROQ_MILESTONE_SETTLEMENT_SCHEMA_HASH,
  type SettlementClaimConfiguration,
} from "./config";
import { broadcastPreparedSettlementClaim, prepareSettlementClaim } from "./issuer";

const SUBJECT_DID = "did:ckb:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ISSUER_DID = "did:ckb:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const CLAIM_ID = `0x${"66".repeat(32)}` as ccc.Hex;
const CONFIGURATION = {
  enabled: true,
  issuerDid: ISSUER_DID,
  issuerPrivateKey: `0x${"77".repeat(32)}` as ccc.Hex,
  minimumConfirmations: 6,
} satisfies Extract<SettlementClaimConfiguration, { enabled: true }>;
const PAYLOAD: VellumSettlementClaimPayload = {
  engagement_id: `0x${"11".repeat(32)}`,
  milestone_id: `0x${"22".repeat(32)}`,
  delivery_id: `0x${"33".repeat(32)}`,
  milestone_sequence: 1,
  approval_method: "client",
  settled_at: 2_000_000_000,
  settlement_tx_hash: `0x${"44".repeat(32)}`,
};

function claimResult(tx: ccc.Transaction): WriteClaimResult {
  return {
    tx,
    claimId: CLAIM_ID,
    outputIndex: 2,
    issuerSource: { kind: "input", inputIndex: 0, outputIndex: 0 },
    controllerInputIndex: 0,
  };
}

describe("Klaveroq settlement claim issuer", () => {
  it("pins the schema and subject, then returns the exact signed transaction", async () => {
    const transaction = ccc.Transaction.default();
    const signer = {
      signOnlyTransaction: vi.fn(async (candidate: ccc.Transaction) => candidate),
    } as unknown as ccc.SignerCkbPrivateKey;
    const createSigner = vi.fn(async (): Promise<ccc.SignerCkbPrivateKey> => signer);
    const writeClaim = vi.fn(async (): Promise<WriteClaimResult> => claimResult(transaction));
    const client = {} as ccc.Client;

    await expect(
      prepareSettlementClaim(
        { issuedAt: 2_000_000_100, payload: PAYLOAD, subjectDid: SUBJECT_DID },
        client,
        CONFIGURATION,
        { createSigner, writeClaim },
      ),
    ).resolves.toEqual({
      claimId: CLAIM_ID,
      outputIndex: 2,
      signedTransaction: ccc.hexFrom(transaction.toBytes()),
      transactionHash: transaction.hash(),
    });
    expect(writeClaim).toHaveBeenCalledWith({
      issuerSigner: signer,
      scripts: claimScripts,
      input: {
        subject: { did: SUBJECT_DID },
        issuerDid: ISSUER_DID,
        schemaHash: KLAVEROQ_MILESTONE_SETTLEMENT_SCHEMA_HASH,
        payload: PAYLOAD,
        issuedAt: 2_000_000_100,
      },
    });
  });

  it("rejects a signer that changes the prepared transaction hash", async () => {
    const transaction = ccc.Transaction.default();
    const signer = {
      signOnlyTransaction: vi.fn(async () => ccc.Transaction.from({ version: 1 })),
    } as unknown as ccc.SignerCkbPrivateKey;

    await expect(
      prepareSettlementClaim(
        { issuedAt: 2_000_000_100, payload: PAYLOAD, subjectDid: SUBJECT_DID },
        {} as ccc.Client,
        CONFIGURATION,
        {
          createSigner: async () => signer,
          writeClaim: async () => claimResult(transaction),
        },
      ),
    ).rejects.toThrow("changed the prepared transaction");
  });

  it("verifies persisted bytes against their hash before broadcast", async () => {
    const transaction = ccc.Transaction.default();
    const sendTransaction = vi.fn(async (candidate: ccc.Transaction) => candidate.hash());
    const client = { sendTransaction } as unknown as ccc.Client;
    const bytes = ccc.hexFrom(transaction.toBytes());

    await expect(broadcastPreparedSettlementClaim(client, bytes, transaction.hash())).resolves.toBe(
      transaction.hash(),
    );
    expect(sendTransaction).toHaveBeenCalledTimes(1);

    await expect(
      broadcastPreparedSettlementClaim(client, bytes, `0x${"aa".repeat(32)}`),
    ).rejects.toThrow("hash does not match");
    expect(sendTransaction).toHaveBeenCalledTimes(1);
  });
});
