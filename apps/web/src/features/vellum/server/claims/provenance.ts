import { ccc } from "@ckb-ccc/core";

const CKB_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export class SettlementProvenanceError extends Error {
  constructor(
    public code: "invalid" | "pending" | "unavailable",
    message: string,
  ) {
    super(message);
  }
}

export async function confirmSettlementTransaction(
  client: ccc.Client,
  transactionHash: string,
  requiredConfirmations: number,
): Promise<{ settledAt: number; transactionHash: ccc.Hex }> {
  if (!CKB_HASH_PATTERN.test(transactionHash)) {
    throw new SettlementProvenanceError("invalid", "The settlement transaction hash is invalid.");
  }
  if (!Number.isSafeInteger(requiredConfirmations) || requiredConfirmations < 1) {
    throw new TypeError("Required settlement confirmations must be a positive integer.");
  }
  const normalizedHash = transactionHash.toLowerCase() as ccc.Hex;
  let settlement: Awaited<ReturnType<ccc.Client["getTransactionWithHeader"]>>;
  try {
    settlement = await client.getTransactionWithHeader(normalizedHash);
  } catch {
    throw new SettlementProvenanceError(
      "unavailable",
      "The CKB settlement transaction could not be read.",
    );
  }
  if (
    !settlement ||
    ["sent", "pending", "proposed", "unknown"].includes(settlement.transaction.status)
  ) {
    throw new SettlementProvenanceError(
      "pending",
      "The CKB settlement transaction is not confirmed yet.",
    );
  }
  if (
    settlement.transaction.status !== "committed" ||
    settlement.transaction.blockNumber === undefined
  ) {
    throw new SettlementProvenanceError(
      "invalid",
      "The CKB settlement transaction was not committed.",
    );
  }

  let tip: ccc.ClientBlockHeader;
  try {
    tip = await client.getTipHeader();
  } catch {
    throw new SettlementProvenanceError("unavailable", "The CKB tip could not be read.");
  }
  const blockNumber = ccc.numFrom(settlement.transaction.blockNumber);
  const tipNumber = ccc.numFrom(tip.number);
  if (tipNumber < blockNumber) {
    throw new SettlementProvenanceError("unavailable", "The CKB settlement height is invalid.");
  }
  if (tipNumber - blockNumber + 1n < BigInt(requiredConfirmations)) {
    throw new SettlementProvenanceError(
      "pending",
      "The CKB settlement transaction is waiting for confirmations.",
    );
  }
  let header = settlement.header;
  if (!header && settlement.transaction.blockHash) {
    try {
      header = await client.getHeaderByHash(settlement.transaction.blockHash);
    } catch {
      throw new SettlementProvenanceError(
        "unavailable",
        "The CKB settlement block header could not be read.",
      );
    }
  }
  if (!header) {
    throw new SettlementProvenanceError(
      "unavailable",
      "The CKB settlement block header is unavailable.",
    );
  }
  const settledAt = Number(ccc.numFrom(header.timestamp) / 1_000n);
  if (!Number.isSafeInteger(settledAt) || settledAt <= 0) {
    throw new SettlementProvenanceError(
      "invalid",
      "The CKB settlement block timestamp is invalid.",
    );
  }
  return { settledAt, transactionHash: normalizedHash };
}
