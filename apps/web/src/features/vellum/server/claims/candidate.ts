import { and, asc, desc, eq, gt, isNotNull, isNull, or } from "drizzle-orm";
import type { ccc } from "@ckb-ccc/core";
import { db } from "@/server/db";
import {
  jobs,
  milestones,
  operations,
  reviews,
  vellumClaimIssuances,
  vellumIdentityBindings,
  wallets,
  type VellumSettlementClaimPayload,
} from "@/server/db/schema";
import { log } from "@/server/observability/logger";
import { resolveControlledIdentity, VellumIdentityError } from "@/features/vellum/server/identity";
import type { SettlementClaimConfiguration } from "./config";
import { confirmSettlementTransaction, SettlementProvenanceError } from "./provenance";
import { buildSettlementClaimPayload } from "./schema";
import { findFirstEligibleCandidate } from "./candidate-pages";

export type SettlementClaimEvidence = {
  issuerDid: string;
  milestoneId: string;
  payload: VellumSettlementClaimPayload;
  settlementOperationId: string;
  subjectDid: string;
};

type SettlementCandidateCursor = {
  operationId: string;
};

const CANDIDATE_PAGE_SIZE = 25;

function metadataRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function approvalMatchesOperation(
  metadata: Record<string, unknown> | undefined,
  approval: { automatic: boolean; proofSubmissionId: string },
): boolean {
  if (!metadata) return false;
  if (metadata.proofId !== approval.proofSubmissionId) return false;
  return approval.automatic ? metadata.automatic === true : metadata.automatic !== true;
}

async function loadSettlementCandidatePage(cursor: SettlementCandidateCursor | undefined) {
  const candidates = await db
    .select({
      operationId: operations.id,
      operationMetadata: operations.metadata,
      settlementTransactionHash: operations.externalReference,
      engagementId: jobs.id,
      milestoneId: milestones.id,
      milestoneSequence: milestones.sequence,
      clientUserId: jobs.clientUserId,
      subjectDid: vellumIdentityBindings.did,
      walletId: wallets.id,
      walletAddress: wallets.address,
      walletNetwork: wallets.network,
    })
    .from(operations)
    .innerJoin(milestones, eq(milestones.id, operations.milestoneId))
    .innerJoin(jobs, and(eq(jobs.id, operations.jobId), eq(jobs.id, milestones.jobId)))
    .innerJoin(vellumIdentityBindings, eq(vellumIdentityBindings.userId, jobs.workerUserId))
    .innerJoin(
      wallets,
      and(
        eq(wallets.id, vellumIdentityBindings.walletId),
        eq(wallets.userId, jobs.workerUserId),
        eq(wallets.status, "VERIFIED"),
        eq(wallets.network, "testnet"),
      ),
    )
    .leftJoin(
      vellumClaimIssuances,
      or(
        eq(vellumClaimIssuances.milestoneId, milestones.id),
        eq(vellumClaimIssuances.settlementOperationId, operations.id),
      ),
    )
    .where(
      and(
        eq(operations.type, "MILESTONE_RELEASE"),
        eq(operations.status, "CONFIRMED"),
        eq(milestones.status, "RELEASED"),
        isNotNull(operations.externalReference),
        isNull(vellumClaimIssuances.id),
        cursor ? gt(operations.id, cursor.operationId) : undefined,
      ),
    )
    .orderBy(asc(operations.id))
    .limit(CANDIDATE_PAGE_SIZE);

  const last = candidates.at(-1);
  return {
    items: candidates,
    nextCursor:
      candidates.length === CANDIDATE_PAGE_SIZE && last
        ? {
            operationId: last.operationId,
          }
        : null,
  };
}

type SettlementCandidate = Awaited<ReturnType<typeof loadSettlementCandidatePage>>["items"][number];

async function inspectSettlementCandidate(
  candidate: SettlementCandidate,
  client: ccc.Client,
  configuration: Extract<SettlementClaimConfiguration, { enabled: true }>,
): Promise<SettlementClaimEvidence | undefined> {
  if (!candidate.settlementTransactionHash) {
    log.warn("vellum.settlement_skipped", {
      operationId: candidate.operationId,
      reason: "missing_transaction",
    });
    return undefined;
  }
  const [approval] = await db
    .select({
      automatic: reviews.automatic,
      proofSubmissionId: reviews.proofSubmissionId,
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.milestoneId, candidate.milestoneId),
        eq(reviews.reviewerUserId, candidate.clientUserId),
        eq(reviews.decision, "APPROVE"),
      ),
    )
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .limit(1);
  if (
    !approval ||
    !approvalMatchesOperation(metadataRecord(candidate.operationMetadata), approval)
  ) {
    log.warn("vellum.settlement_skipped", {
      operationId: candidate.operationId,
      reason: "approval_provenance",
    });
    return undefined;
  }

  let settlement: Awaited<ReturnType<typeof confirmSettlementTransaction>>;
  try {
    settlement = await confirmSettlementTransaction(
      client,
      candidate.settlementTransactionHash,
      configuration.minimumConfirmations,
    );
  } catch (error) {
    if (error instanceof SettlementProvenanceError && error.code !== "unavailable") {
      log.warn("vellum.settlement_skipped", {
        operationId: candidate.operationId,
        reason: error.code === "pending" ? "confirmations_pending" : "invalid_transaction",
      });
      return undefined;
    }
    throw error;
  }

  try {
    await resolveControlledIdentity(
      client,
      {
        id: candidate.walletId,
        address: candidate.walletAddress,
        network: candidate.walletNetwork,
      },
      candidate.subjectDid,
    );
  } catch (error) {
    if (error instanceof VellumIdentityError) {
      log.warn("vellum.settlement_skipped", {
        operationId: candidate.operationId,
        reason: error.code,
      });
      return undefined;
    }
    throw error;
  }

  let payload: VellumSettlementClaimPayload;
  try {
    payload = buildSettlementClaimPayload({
      approvalMethod: approval.automatic ? "review_timeout" : "client",
      deliveryId: approval.proofSubmissionId,
      engagementId: candidate.engagementId,
      milestoneId: candidate.milestoneId,
      milestoneSequence: candidate.milestoneSequence,
      settledAt: settlement.settledAt,
      settlementTransactionHash: settlement.transactionHash,
    });
  } catch {
    log.warn("vellum.settlement_skipped", {
      operationId: candidate.operationId,
      reason: "invalid_payload",
    });
    return undefined;
  }
  return {
    issuerDid: configuration.issuerDid,
    milestoneId: candidate.milestoneId,
    payload,
    settlementOperationId: candidate.operationId,
    subjectDid: candidate.subjectDid,
  };
}

export async function findSettlementClaimEvidence(
  client: ccc.Client,
  configuration: Extract<SettlementClaimConfiguration, { enabled: true }>,
): Promise<SettlementClaimEvidence | undefined> {
  return findFirstEligibleCandidate(loadSettlementCandidatePage, (candidate) =>
    inspectSettlementCandidate(candidate, client, configuration),
  );
}
