import type { ccc } from "@ckb-ccc/core";
import { describe, expect, it, vi } from "vitest";
import type { SettlementClaimEvidence } from "./candidate";
import type { SettlementClaimConfiguration } from "./config";
import type { PreparedSettlementClaim } from "./issuer";
import { runSettlementClaimIssuance, type SettlementClaimServiceDependencies } from "./service";
import type {
  NewSettlementClaimIssuance,
  SettlementClaimIssuance,
  SettlementClaimIssuanceChanges,
  SettlementClaimStore,
  SettlementIssuerLease,
  SettlementIssuerLeaseChanges,
} from "./store";

const SUBJECT_DID = "did:ckb:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ISSUER_DID = "did:ckb:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const CLAIM_TRANSACTION_HASH = `0x${"55".repeat(32)}`;
const EVIDENCE: SettlementClaimEvidence = {
  issuerDid: ISSUER_DID,
  milestoneId: "22222222-2222-4222-8222-222222222222",
  settlementOperationId: "44444444-4444-4444-8444-444444444444",
  subjectDid: SUBJECT_DID,
  payload: {
    engagement_id: `0x${"11".repeat(32)}`,
    milestone_id: `0x${"22".repeat(32)}`,
    delivery_id: `0x${"33".repeat(32)}`,
    milestone_sequence: 1,
    approval_method: "client",
    settled_at: 2_000_000_000,
    settlement_tx_hash: `0x${"44".repeat(32)}`,
  },
};
const PREPARED: PreparedSettlementClaim = {
  claimId: `0x${"66".repeat(32)}` as ccc.Hex,
  outputIndex: 0,
  signedTransaction: "0x1234" as ccc.Hex,
  transactionHash: CLAIM_TRANSACTION_HASH as ccc.Hex,
};
const CONFIGURATION = {
  enabled: true,
  issuerDid: ISSUER_DID,
  issuerPrivateKey: `0x${"77".repeat(32)}` as ccc.Hex,
  minimumConfirmations: 6,
} satisfies Extract<SettlementClaimConfiguration, { enabled: true }>;

function copy<T>(value: T): T {
  return structuredClone(value);
}

class MemorySettlementClaimStore implements SettlementClaimStore {
  issuance: SettlementClaimIssuance | null = null;
  lease: SettlementIssuerLease | null = null;

  async createIssuance(input: NewSettlementClaimIssuance) {
    if (
      this.issuance &&
      (this.issuance.milestoneId === input.milestoneId ||
        this.issuance.settlementOperationId === input.settlementOperationId)
    ) {
      return null;
    }
    const now = new Date();
    this.issuance = {
      ...copy(input),
      id: "55555555-5555-4555-8555-555555555555",
      status: "PREPARING",
      claimId: null,
      outputIndex: null,
      signedTransaction: null,
      transactionHash: null,
      lastErrorCode: null,
      confirmedAt: null,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    return copy(this.issuance);
  }

  async getIssuance(id: string) {
    return this.issuance?.id === id ? copy(this.issuance) : null;
  }

  async getIssuanceByMilestone(milestoneId: string) {
    return this.issuance?.milestoneId === milestoneId ? copy(this.issuance) : null;
  }

  async getActiveIssuance() {
    return this.issuance && ["PREPARING", "PREPARED", "SUBMITTED"].includes(this.issuance.status)
      ? copy(this.issuance)
      : null;
  }

  async updateIssuance(id: string, revision: number, changes: SettlementClaimIssuanceChanges) {
    if (!this.issuance || this.issuance.id !== id || this.issuance.revision !== revision) {
      return null;
    }
    this.issuance = {
      ...this.issuance,
      ...copy(changes),
      revision: revision + 1,
      updatedAt: new Date(),
    };
    return copy(this.issuance);
  }

  async createLease(input: { expiresAt: Date; key: string; token: string }) {
    if (this.lease) return null;
    const now = new Date();
    this.lease = {
      ...copy(input),
      issuanceId: null,
      transactionHash: null,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    return copy(this.lease);
  }

  async getLease(key: string) {
    return this.lease?.key === key ? copy(this.lease) : null;
  }

  async updateLease(
    key: string,
    revision: number,
    token: string,
    changes: SettlementIssuerLeaseChanges,
  ) {
    if (
      !this.lease ||
      this.lease.key !== key ||
      this.lease.revision !== revision ||
      this.lease.token !== token
    ) {
      return null;
    }
    this.lease = {
      ...this.lease,
      ...copy(changes),
      revision: revision + 1,
      updatedAt: new Date(),
    };
    return copy(this.lease);
  }

  async deleteLease(key: string, revision: number, token: string) {
    if (
      !this.lease ||
      this.lease.key !== key ||
      this.lease.revision !== revision ||
      this.lease.token !== token
    ) {
      return false;
    }
    this.lease = null;
    return true;
  }
}

function fixture(store = new MemorySettlementClaimStore()) {
  let now = new Date("2033-05-18T03:35:00.000Z");
  let transactionStatus: "committed" | "pending" | "rejected" | undefined;
  let tokenIndex = 0;
  const prepare = vi.fn(async () => PREPARED);
  const findEvidence = vi.fn(async (): Promise<SettlementClaimEvidence | undefined> => EVIDENCE);
  const client = {
    getTransaction: vi.fn(async () =>
      transactionStatus ? { status: transactionStatus } : undefined,
    ),
  } as unknown as ccc.Client;
  const broadcast = vi.fn(async () => {
    expect(store.issuance).toMatchObject({
      signedTransaction: PREPARED.signedTransaction,
      status: "PREPARED",
      transactionHash: PREPARED.transactionHash,
    });
    expect(store.lease).toMatchObject({
      issuanceId: store.issuance?.id,
      transactionHash: PREPARED.transactionHash,
    });
    return PREPARED.transactionHash;
  });
  const dependencies: SettlementClaimServiceDependencies = {
    broadcast,
    client,
    findEvidence,
    now: () => now,
    prepare,
    store,
    token: () => `00000000-0000-4000-8000-${String(++tokenIndex).padStart(12, "0")}`,
  };
  return {
    advance(milliseconds: number) {
      now = new Date(now.getTime() + milliseconds);
    },
    broadcast,
    dependencies,
    findEvidence,
    prepare,
    setTransactionStatus(status: typeof transactionStatus) {
      transactionStatus = status;
    },
    store,
  };
}

describe("Klaveroq settlement claim issuance", () => {
  it("persists the subject and signed transaction before broadcasting", async () => {
    const setup = fixture();
    await expect(
      runSettlementClaimIssuance(CONFIGURATION, setup.dependencies),
    ).resolves.toMatchObject({ status: "submitted", transactionHash: CLAIM_TRANSACTION_HASH });
    expect(setup.store.issuance).toMatchObject({
      subjectDid: SUBJECT_DID,
      issuerDid: ISSUER_DID,
      status: "SUBMITTED",
    });
    expect(setup.prepare).toHaveBeenCalledTimes(1);
    expect(setup.broadcast).toHaveBeenCalledTimes(1);

    await expect(
      runSettlementClaimIssuance(CONFIGURATION, setup.dependencies),
    ).resolves.toMatchObject({ status: "pending" });
    expect(setup.prepare).toHaveBeenCalledTimes(1);
    expect(setup.broadcast).toHaveBeenCalledTimes(1);

    setup.setTransactionStatus("committed");
    await expect(
      runSettlementClaimIssuance(CONFIGURATION, setup.dependencies),
    ).resolves.toMatchObject({ status: "confirmed" });
    expect(setup.store.issuance?.status).toBe("CONFIRMED");
    expect(setup.store.lease).toBeNull();
  });

  it("serializes concurrent runs so the settlement is signed only once", async () => {
    const setup = fixture();
    const outcomes = await Promise.all([
      runSettlementClaimIssuance(CONFIGURATION, setup.dependencies),
      runSettlementClaimIssuance(CONFIGURATION, setup.dependencies),
    ]);
    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual(["pending", "submitted"]);
    expect(setup.findEvidence).toHaveBeenCalledTimes(1);
    expect(setup.prepare).toHaveBeenCalledTimes(1);
    expect(setup.broadcast).toHaveBeenCalledTimes(1);
  });

  it("rebroadcasts the persisted bytes after an ambiguous broadcast failure", async () => {
    const setup = fixture();
    setup.broadcast.mockRejectedValueOnce(new Error("RPC unavailable"));
    await expect(runSettlementClaimIssuance(CONFIGURATION, setup.dependencies)).rejects.toThrow(
      "RPC unavailable",
    );
    expect(setup.store.issuance).toMatchObject({
      signedTransaction: PREPARED.signedTransaction,
      status: "PREPARED",
    });
    setup.advance(61_000);

    await expect(
      runSettlementClaimIssuance(CONFIGURATION, setup.dependencies),
    ).resolves.toMatchObject({ status: "submitted" });
    expect(setup.prepare).toHaveBeenCalledTimes(1);
    expect(setup.broadcast).toHaveBeenCalledTimes(2);
    expect(setup.broadcast.mock.calls[1]?.length).toBeGreaterThan(0);
    expect(setup.findEvidence).toHaveBeenCalledTimes(1);
    expect(setup.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ subjectDid: SUBJECT_DID }),
      expect.anything(),
      CONFIGURATION,
    );
  });

  it("recovers an expired lease left behind before an issuance was reserved", async () => {
    const setup = fixture();
    await setup.store.createLease({
      expiresAt: new Date("2033-05-18T03:34:59.000Z"),
      key: "primary",
      token: "00000000-0000-4000-8000-999999999999",
    });

    await expect(
      runSettlementClaimIssuance(CONFIGURATION, setup.dependencies),
    ).resolves.toMatchObject({ status: "submitted", transactionHash: CLAIM_TRANSACTION_HASH });
    expect(setup.findEvidence).toHaveBeenCalledTimes(1);
    expect(setup.prepare).toHaveBeenCalledTimes(1);
    expect(setup.broadcast).toHaveBeenCalledTimes(1);
  });

  it("does not broadcast until the persisted transaction owns the issuer lease", async () => {
    class BlockingLeaseStore extends MemorySettlementClaimStore {
      blockTransactionBinding = true;

      override updateLease(
        key: string,
        revision: number,
        token: string,
        changes: SettlementIssuerLeaseChanges,
      ) {
        if (this.blockTransactionBinding && changes.transactionHash) {
          return Promise.resolve(null);
        }
        return super.updateLease(key, revision, token, changes);
      }
    }

    const store = new BlockingLeaseStore();
    const setup = fixture(store);
    await expect(runSettlementClaimIssuance(CONFIGURATION, setup.dependencies)).rejects.toThrow(
      "issuer lease changed",
    );
    expect(setup.store.issuance?.status).toBe("PREPARED");
    expect(setup.broadcast).not.toHaveBeenCalled();

    store.blockTransactionBinding = false;
    setup.advance(181_000);
    await expect(
      runSettlementClaimIssuance(CONFIGURATION, setup.dependencies),
    ).resolves.toMatchObject({ status: "submitted", transactionHash: CLAIM_TRANSACTION_HASH });
    expect(setup.prepare).toHaveBeenCalledTimes(1);
    expect(setup.broadcast).toHaveBeenCalledTimes(1);
  });

  it("stops the issuer queue when the stored transaction is rejected", async () => {
    const setup = fixture();
    await runSettlementClaimIssuance(CONFIGURATION, setup.dependencies);
    setup.setTransactionStatus("rejected");
    await expect(
      runSettlementClaimIssuance(CONFIGURATION, setup.dependencies),
    ).resolves.toMatchObject({ status: "review_required" });
    expect(setup.store.issuance).toMatchObject({
      lastErrorCode: "claim_transaction_rejected",
      status: "REVIEW_REQUIRED",
    });
    expect(setup.store.lease).not.toBeNull();
  });

  it("returns idle and releases the issuer when no settlement is eligible", async () => {
    const setup = fixture();
    setup.findEvidence.mockResolvedValueOnce(undefined);
    await expect(runSettlementClaimIssuance(CONFIGURATION, setup.dependencies)).resolves.toEqual({
      status: "idle",
    });
    expect(setup.store.issuance).toBeNull();
    expect(setup.store.lease).toBeNull();
  });
});
