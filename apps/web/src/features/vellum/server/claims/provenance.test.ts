import type { ccc } from "@ckb-ccc/core";
import { describe, expect, it, vi } from "vitest";
import { confirmSettlementTransaction, SettlementProvenanceError } from "./provenance";

const TRANSACTION_HASH = `0x${"44".repeat(32)}`;

function fixture(
  options: {
    blockNumber?: bigint;
    status?: string;
    tipNumber?: bigint;
    timestamp?: bigint;
  } = {},
) {
  const blockNumber = options.blockNumber ?? 100n;
  const client = {
    getHeaderByHash: vi.fn(),
    getTipHeader: vi.fn(async () => ({ number: options.tipNumber ?? 105n })),
    getTransactionWithHeader: vi.fn(async () => ({
      header: { timestamp: options.timestamp ?? 2_000_000_000_000n },
      transaction: {
        blockHash: `0x${"55".repeat(32)}`,
        blockNumber,
        status: options.status ?? "committed",
      },
    })),
  } as unknown as ccc.Client;
  return client;
}

describe("Klaveroq settlement provenance", () => {
  it("uses the committed block timestamp after the required confirmation depth", async () => {
    await expect(confirmSettlementTransaction(fixture(), TRANSACTION_HASH, 6)).resolves.toEqual({
      settledAt: 2_000_000_000,
      transactionHash: TRANSACTION_HASH,
    });
  });

  it("keeps immature and mempool transactions pending", async () => {
    await expect(
      confirmSettlementTransaction(fixture({ tipNumber: 104n }), TRANSACTION_HASH, 6),
    ).rejects.toMatchObject({ code: "pending" });
    await expect(
      confirmSettlementTransaction(fixture({ status: "pending" }), TRANSACTION_HASH, 6),
    ).rejects.toMatchObject({ code: "pending" });
  });

  it("rejects malformed, rejected, and invalid timestamp evidence", async () => {
    await expect(confirmSettlementTransaction(fixture(), "not-a-hash", 6)).rejects.toBeInstanceOf(
      SettlementProvenanceError,
    );
    await expect(
      confirmSettlementTransaction(fixture({ status: "rejected" }), TRANSACTION_HASH, 6),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      confirmSettlementTransaction(fixture({ timestamp: 0n }), TRANSACTION_HASH, 6),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("treats an unavailable fallback block header as retryable", async () => {
    const client = fixture();
    vi.mocked(client.getTransactionWithHeader).mockResolvedValueOnce({
      header: undefined,
      transaction: {
        blockHash: `0x${"55".repeat(32)}`,
        blockNumber: 100n,
        status: "committed",
      },
    } as Awaited<ReturnType<ccc.Client["getTransactionWithHeader"]>>);
    vi.mocked(client.getHeaderByHash).mockRejectedValueOnce(new Error("RPC unavailable"));

    await expect(confirmSettlementTransaction(client, TRANSACTION_HASH, 6)).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});
