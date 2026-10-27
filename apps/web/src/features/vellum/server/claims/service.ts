import type { ccc } from "@ckb-ccc/core";
import type { VellumSettlementClaimPayload } from "@/server/db/schema";
import type { SettlementClaimEvidence } from "./candidate";
import type { SettlementClaimConfiguration } from "./config";
import type { PreparedSettlementClaim } from "./issuer";
import type { SettlementClaimIssuance, SettlementClaimStore, SettlementIssuerLease } from "./store";

const ISSUER_LEASE_KEY = "primary";
const PREPARATION_LEASE_MS = 3 * 60_000;
const SUBMITTED_LEASE_MS = 10 * 60_000;
const REBROADCAST_AFTER_MS = 60_000;

export type SettlementClaimRunResult = {
  status: "confirmed" | "idle" | "pending" | "review_required" | "submitted";
  issuanceId?: string;
  transactionHash?: string;
};

export type SettlementClaimServiceDependencies = {
  broadcast: (
    client: ccc.Client,
    signedTransaction: ccc.HexLike,
    expectedHash: ccc.HexLike,
  ) => Promise<ccc.Hex>;
  client: ccc.Client;
  findEvidence: (
    client: ccc.Client,
    configuration: Extract<SettlementClaimConfiguration, { enabled: true }>,
  ) => Promise<SettlementClaimEvidence | undefined>;
  now: () => Date;
  prepare: (
    input: {
      issuedAt: number;
      payload: VellumSettlementClaimPayload;
      subjectDid: string;
    },
    client: ccc.Client,
    configuration: Extract<SettlementClaimConfiguration, { enabled: true }>,
  ) => Promise<PreparedSettlementClaim>;
  store: SettlementClaimStore;
  token: () => string;
};

function result(
  status: SettlementClaimRunResult["status"],
  issuance?: SettlementClaimIssuance,
): SettlementClaimRunResult {
  return {
    status,
    ...(issuance
      ? {
          issuanceId: issuance.id,
          ...(issuance.transactionHash ? { transactionHash: issuance.transactionHash } : {}),
        }
      : {}),
  };
}

function unixSeconds(date: Date): number {
  const value = Math.floor(date.getTime() / 1_000);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error("Claim service clock is invalid.");
  return value;
}

function requirePrepared(issuance: SettlementClaimIssuance): {
  signedTransaction: ccc.Hex;
  transactionHash: ccc.Hex;
} {
  if (!issuance.signedTransaction || !issuance.transactionHash) {
    throw new Error("Persisted Claim Cell transaction is incomplete.");
  }
  return {
    signedTransaction: issuance.signedTransaction as ccc.Hex,
    transactionHash: issuance.transactionHash as ccc.Hex,
  };
}

async function transactionState(
  dependencies: SettlementClaimServiceDependencies,
  transactionHash: string,
) {
  const transaction = await dependencies.client.getTransaction(transactionHash);
  return transaction?.status === "unknown" ? undefined : transaction;
}

async function markConfirmed(
  dependencies: SettlementClaimServiceDependencies,
  lease: SettlementIssuerLease,
  issuance: SettlementClaimIssuance,
  now: Date,
): Promise<SettlementClaimRunResult> {
  const updated =
    issuance.status === "CONFIRMED"
      ? issuance
      : await dependencies.store.updateIssuance(issuance.id, issuance.revision, {
          confirmedAt: now,
          lastErrorCode: null,
          status: "CONFIRMED",
        });
  const confirmed = updated ?? (await dependencies.store.getIssuance(issuance.id));
  if (!confirmed || confirmed.status !== "CONFIRMED") {
    return result("pending", issuance);
  }
  await dependencies.store.deleteLease(lease.key, lease.revision, lease.token);
  return result("confirmed", confirmed);
}

async function markReviewRequired(
  dependencies: SettlementClaimServiceDependencies,
  issuance: SettlementClaimIssuance,
): Promise<SettlementClaimRunResult> {
  const updated = await dependencies.store.updateIssuance(issuance.id, issuance.revision, {
    lastErrorCode: "claim_transaction_rejected",
    status: "REVIEW_REQUIRED",
  });
  const current = updated ?? (await dependencies.store.getIssuance(issuance.id));
  if (current?.status === "REVIEW_REQUIRED") return result("review_required", current);
  if (current?.status === "CONFIRMED") return result("confirmed", current);
  return result("pending", current ?? issuance);
}

async function adoptExpiredLease(
  dependencies: SettlementClaimServiceDependencies,
  lease: SettlementIssuerLease,
  issuance: SettlementClaimIssuance,
  now: Date,
): Promise<{ issuance: SettlementClaimIssuance; lease: SettlementIssuerLease } | undefined> {
  if (lease.expiresAt > now) return undefined;
  const token = dependencies.token();
  const adoptedLease = await dependencies.store.updateLease(
    lease.key,
    lease.revision,
    lease.token,
    {
      expiresAt: new Date(now.getTime() + PREPARATION_LEASE_MS),
      token,
    },
  );
  if (!adoptedLease) return undefined;
  const adoptedIssuance = await dependencies.store.updateIssuance(issuance.id, issuance.revision, {
    leaseToken: token,
  });
  if (!adoptedIssuance) {
    await dependencies.store.updateLease(
      adoptedLease.key,
      adoptedLease.revision,
      adoptedLease.token,
      { expiresAt: now },
    );
    return undefined;
  }
  return { issuance: adoptedIssuance, lease: adoptedLease };
}

async function bindLease(
  dependencies: SettlementClaimServiceDependencies,
  lease: SettlementIssuerLease,
  issuance: SettlementClaimIssuance,
  now: Date,
): Promise<SettlementIssuerLease> {
  if (
    lease.issuanceId === issuance.id &&
    lease.transactionHash === issuance.transactionHash &&
    lease.expiresAt.getTime() >= now.getTime() + SUBMITTED_LEASE_MS - 1_000
  ) {
    return lease;
  }
  const updated = await dependencies.store.updateLease(lease.key, lease.revision, lease.token, {
    expiresAt: new Date(now.getTime() + SUBMITTED_LEASE_MS),
    issuanceId: issuance.id,
    transactionHash: issuance.transactionHash,
  });
  if (!updated) throw new Error("The issuer lease changed while binding a Claim Cell transaction.");
  return updated;
}

async function broadcastPrepared(
  dependencies: SettlementClaimServiceDependencies,
  lease: SettlementIssuerLease,
  issuance: SettlementClaimIssuance,
  now: Date,
): Promise<SettlementClaimRunResult> {
  const prepared = requirePrepared(issuance);
  let chainTransaction = await transactionState(dependencies, prepared.transactionHash);
  if (!chainTransaction) {
    try {
      const broadcastHash = await dependencies.broadcast(
        dependencies.client,
        prepared.signedTransaction,
        prepared.transactionHash,
      );
      if (broadcastHash !== prepared.transactionHash) {
        throw new Error("Broadcast Claim Cell transaction hash changed.");
      }
    } catch (error) {
      chainTransaction = await transactionState(dependencies, prepared.transactionHash);
      if (!chainTransaction) {
        await dependencies.store.updateIssuance(issuance.id, issuance.revision, {
          lastErrorCode: "claim_broadcast_failed",
        });
        await dependencies.store.updateLease(lease.key, lease.revision, lease.token, {
          expiresAt: new Date(now.getTime() + REBROADCAST_AFTER_MS),
        });
        throw error;
      }
    }
  }
  if (chainTransaction?.status === "rejected") {
    return markReviewRequired(dependencies, issuance);
  }
  if (chainTransaction?.status === "committed") {
    return markConfirmed(dependencies, lease, issuance, now);
  }
  const submitted = await dependencies.store.updateIssuance(issuance.id, issuance.revision, {
    lastErrorCode: null,
    status: "SUBMITTED",
  });
  const current = submitted ?? (await dependencies.store.getIssuance(issuance.id));
  if (current?.status === "SUBMITTED") return result("submitted", current);
  if (current?.status === "CONFIRMED") return result("confirmed", current);
  if (current?.status === "REVIEW_REQUIRED") return result("review_required", current);
  return result("pending", current ?? issuance);
}

async function advanceOwnedIssuance(
  dependencies: SettlementClaimServiceDependencies,
  configuration: Extract<SettlementClaimConfiguration, { enabled: true }>,
  initialLease: SettlementIssuerLease,
  initialIssuance: SettlementClaimIssuance,
  now: Date,
): Promise<SettlementClaimRunResult> {
  let lease = initialLease;
  let issuance = initialIssuance;
  if (issuance.issuerDid !== configuration.issuerDid) {
    throw new Error("The reserved claim issuer does not match the configured issuer DID.");
  }
  if (issuance.status === "PREPARING") {
    try {
      const prepared = await dependencies.prepare(
        {
          issuedAt: unixSeconds(issuance.issuedAt),
          payload: issuance.payload,
          subjectDid: issuance.subjectDid,
        },
        dependencies.client,
        configuration,
      );
      const updated = await dependencies.store.updateIssuance(issuance.id, issuance.revision, {
        claimId: prepared.claimId,
        lastErrorCode: null,
        outputIndex: prepared.outputIndex,
        signedTransaction: prepared.signedTransaction,
        status: "PREPARED",
        transactionHash: prepared.transactionHash,
      });
      if (!updated) throw new Error("The claim reservation changed during preparation.");
      issuance = updated;
    } catch (error) {
      await dependencies.store.updateIssuance(issuance.id, issuance.revision, {
        lastErrorCode: "claim_preparation_failed",
      });
      await dependencies.store.updateLease(lease.key, lease.revision, lease.token, {
        expiresAt: now,
      });
      throw error;
    }
  }
  if (issuance.status === "PREPARED") {
    lease = await bindLease(dependencies, lease, issuance, now);
    return broadcastPrepared(dependencies, lease, issuance, now);
  }
  if (issuance.status === "SUBMITTED") {
    return refreshSubmitted(dependencies, lease, issuance, now);
  }
  if (issuance.status === "CONFIRMED") return markConfirmed(dependencies, lease, issuance, now);
  return result("review_required", issuance);
}

async function refreshSubmitted(
  dependencies: SettlementClaimServiceDependencies,
  lease: SettlementIssuerLease,
  issuance: SettlementClaimIssuance,
  now: Date,
): Promise<SettlementClaimRunResult> {
  const prepared = requirePrepared(issuance);
  const transaction = await transactionState(dependencies, prepared.transactionHash);
  if (transaction?.status === "committed") {
    return markConfirmed(dependencies, lease, issuance, now);
  }
  if (transaction?.status === "rejected") {
    return markReviewRequired(dependencies, issuance);
  }
  if (transaction) return result("pending", issuance);
  const adopted = await adoptExpiredLease(dependencies, lease, issuance, now);
  if (!adopted) return result("pending", issuance);
  const bound = await bindLease(dependencies, adopted.lease, adopted.issuance, now);
  return broadcastPrepared(dependencies, bound, adopted.issuance, now);
}

async function resumeExistingLease(
  dependencies: SettlementClaimServiceDependencies,
  configuration: Extract<SettlementClaimConfiguration, { enabled: true }>,
  lease: SettlementIssuerLease,
  now: Date,
): Promise<SettlementClaimRunResult> {
  if (!lease.issuanceId) {
    if (lease.expiresAt > now) return result("pending");
    throw new Error("The expired issuer lease is not attached to an issuance.");
  }
  const issuance = await dependencies.store.getIssuance(lease.issuanceId);
  if (!issuance) throw new Error("The issuer lease references a missing claim issuance.");
  if (lease.transactionHash && lease.transactionHash !== issuance.transactionHash) {
    throw new Error("The issuer lease references a different Claim Cell transaction.");
  }
  if (issuance.status === "SUBMITTED") {
    return refreshSubmitted(dependencies, lease, issuance, now);
  }
  if (issuance.status === "CONFIRMED") {
    return markConfirmed(dependencies, lease, issuance, now);
  }
  if (issuance.status === "REVIEW_REQUIRED") return result("review_required", issuance);
  const adopted = await adoptExpiredLease(dependencies, lease, issuance, now);
  if (!adopted) return result("pending", issuance);
  return advanceOwnedIssuance(dependencies, configuration, adopted.lease, adopted.issuance, now);
}

async function acquireLease(
  dependencies: SettlementClaimServiceDependencies,
  now: Date,
): Promise<SettlementIssuerLease | undefined> {
  const token = dependencies.token();
  const created = await dependencies.store.createLease({
    expiresAt: new Date(now.getTime() + PREPARATION_LEASE_MS),
    key: ISSUER_LEASE_KEY,
    token,
  });
  if (created) return created;
  const current = await dependencies.store.getLease(ISSUER_LEASE_KEY);
  if (!current || current.transactionHash || current.expiresAt > now) return undefined;
  return (
    (await dependencies.store.updateLease(current.key, current.revision, current.token, {
      expiresAt: new Date(now.getTime() + PREPARATION_LEASE_MS),
      token,
    })) ?? undefined
  );
}

async function attachIssuance(
  dependencies: SettlementClaimServiceDependencies,
  lease: SettlementIssuerLease,
  issuance: SettlementClaimIssuance,
): Promise<{ issuance: SettlementClaimIssuance; lease: SettlementIssuerLease }> {
  let currentIssuance = issuance;
  if (currentIssuance.leaseToken !== lease.token) {
    const updated = await dependencies.store.updateIssuance(
      currentIssuance.id,
      currentIssuance.revision,
      { leaseToken: lease.token },
    );
    if (!updated) throw new Error("The active claim issuance changed while acquiring its lease.");
    currentIssuance = updated;
  }
  const currentLease = await dependencies.store.updateLease(
    lease.key,
    lease.revision,
    lease.token,
    {
      issuanceId: currentIssuance.id,
      transactionHash: currentIssuance.transactionHash,
    },
  );
  if (!currentLease) throw new Error("The issuer lease changed while attaching an issuance.");
  return { issuance: currentIssuance, lease: currentLease };
}

export async function runSettlementClaimIssuance(
  configuration: Extract<SettlementClaimConfiguration, { enabled: true }>,
  dependencies: SettlementClaimServiceDependencies,
): Promise<SettlementClaimRunResult> {
  const now = dependencies.now();
  unixSeconds(now);

  const existingLease = await dependencies.store.getLease(ISSUER_LEASE_KEY);
  if (existingLease?.issuanceId) {
    return resumeExistingLease(dependencies, configuration, existingLease, now);
  }
  if (existingLease?.transactionHash) {
    throw new Error("The issuer lease has a transaction without an attached issuance.");
  }

  const lease = await acquireLease(dependencies, now);
  if (!lease) return result("pending");
  let issuance = await dependencies.store.getActiveIssuance();
  if (!issuance) {
    const evidence = await dependencies.findEvidence(dependencies.client, configuration);
    if (!evidence) {
      await dependencies.store.deleteLease(lease.key, lease.revision, lease.token);
      return result("idle");
    }
    issuance = await dependencies.store.createIssuance({
      issuerDid: evidence.issuerDid,
      issuedAt: new Date(unixSeconds(now) * 1_000),
      leaseToken: lease.token,
      milestoneId: evidence.milestoneId,
      payload: evidence.payload,
      settlementOperationId: evidence.settlementOperationId,
      subjectDid: evidence.subjectDid,
    });
    if (!issuance) {
      issuance = await dependencies.store.getIssuanceByMilestone(evidence.milestoneId);
      if (!issuance) throw new Error("The settlement claim reservation could not be read.");
    }
  }
  const attached = await attachIssuance(dependencies, lease, issuance);
  return advanceOwnedIssuance(dependencies, configuration, attached.lease, attached.issuance, now);
}
