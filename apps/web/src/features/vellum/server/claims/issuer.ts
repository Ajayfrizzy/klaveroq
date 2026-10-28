import { ccc } from "@ckb-ccc/core";
import { resolveDidCkb } from "@ckb-ccc/did-ckb";
import type { WriteClaimProps, WriteClaimResult } from "@usevellum/sdk";
import type { VellumSettlementClaimPayload } from "@/server/db/schema";
import {
  claimScripts,
  KLAVEROQ_MILESTONE_SETTLEMENT_SCHEMA_HASH,
  type SettlementClaimConfiguration,
} from "./config";

export type PreparedSettlementClaim = {
  claimId: ccc.Hex;
  outputIndex: number;
  signedTransaction: ccc.Hex;
  transactionHash: ccc.Hex;
};

type ClaimWriter = (
  props: WriteClaimProps<VellumSettlementClaimPayload>,
) => Promise<WriteClaimResult>;

export async function createIssuerSigner(
  client: ccc.Client,
  configuration: Extract<SettlementClaimConfiguration, { enabled: true }>,
): Promise<ccc.SignerCkbPrivateKey> {
  const signer = new ccc.SignerCkbPrivateKey(client, configuration.issuerPrivateKey);
  const issuer = await resolveDidCkb({ client, did: configuration.issuerDid });
  if (!issuer) throw new Error("The Klaveroq issuer DID is not active on CKB Testnet.");

  const addresses = await signer.getAddressObjs();
  if (!addresses.some(({ script }) => script.eq(issuer.cell.cellOutput.lock))) {
    throw new Error("The Klaveroq issuer credential does not control the live issuer DID.");
  }
  return signer;
}

export async function prepareSettlementClaim(
  input: {
    issuedAt: number;
    payload: VellumSettlementClaimPayload;
    subjectDid: string;
  },
  client: ccc.Client,
  configuration: Extract<SettlementClaimConfiguration, { enabled: true }>,
  dependencies: {
    createSigner?: typeof createIssuerSigner;
    writeClaim?: ClaimWriter;
  } = {},
): Promise<PreparedSettlementClaim> {
  if (!Number.isSafeInteger(input.issuedAt) || input.issuedAt <= 0) {
    throw new TypeError("Claim issuance time must be a positive Unix timestamp.");
  }
  const signer = await (dependencies.createSigner ?? createIssuerSigner)(client, configuration);
  const writer =
    dependencies.writeClaim ??
    (async (props: WriteClaimProps<VellumSettlementClaimPayload>) => {
      const { writeClaim } = await import("@usevellum/sdk");
      return writeClaim(props);
    });
  const built = await writer({
    issuerSigner: signer,
    scripts: claimScripts,
    input: {
      subject: { did: input.subjectDid },
      issuerDid: configuration.issuerDid,
      schemaHash: KLAVEROQ_MILESTONE_SETTLEMENT_SCHEMA_HASH,
      payload: input.payload,
      issuedAt: input.issuedAt,
    },
  });

  const preparedHash = built.tx.hash();
  const signed = await signer.signOnlyTransaction(built.tx);
  if (signed.hash() !== preparedHash) {
    throw new Error("The issuer signer changed the prepared transaction.");
  }
  return {
    claimId: built.claimId,
    outputIndex: built.outputIndex,
    signedTransaction: ccc.hexFrom(signed.toBytes()),
    transactionHash: preparedHash,
  };
}

export async function broadcastPreparedSettlementClaim(
  client: ccc.Client,
  signedTransaction: ccc.HexLike,
  expectedHash: ccc.HexLike,
): Promise<ccc.Hex> {
  const transaction = ccc.Transaction.fromBytes(signedTransaction);
  const transactionHash = transaction.hash();
  if (transactionHash !== ccc.hexFrom(expectedHash)) {
    throw new Error("Stored Claim Cell transaction hash does not match its bytes.");
  }
  return client.sendTransaction(transaction);
}
