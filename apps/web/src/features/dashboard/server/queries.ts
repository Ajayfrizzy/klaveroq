import { and, asc, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  auditLogs,
  identityVerifications,
  jobListings,
  jobs,
  milestones,
  portfolioItems,
  profiles,
  proposals,
  wallets,
} from "@/server/db/schema";
import { getUserFinancialSummary } from "@/features/payments/server/queries";
import { isFirstTimeUser } from "./onboarding";
import { pendingActionSummary, pendingActionTitle } from "./pending-actions";

const activeStatuses = [
  "INVITED",
  "AWAITING_FUNDING",
  "FUNDED_AWAITING_ACCEPTANCE",
  "ACCEPTED",
  "IN_PROGRESS",
  "CANCELLATION_PENDING",
  "DISPUTED",
  "SECURITY_HOLD",
] as const;

export async function getDashboardData(userId: string, emailVerified: boolean) {
  const [
    jobRows,
    activeJobTotals,
    identityRows,
    walletRows,
    activityRows,
    agreementHistory,
    listingHistory,
    proposalHistory,
    portfolioHistory,
    ownProfile,
    financials,
    invitationActionTotals,
    milestoneActionTotals,
    invitationActions,
    milestoneActions,
  ] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(
        and(
          or(eq(jobs.clientUserId, userId), eq(jobs.workerUserId, userId)),
          inArray(jobs.status, activeStatuses),
        ),
      )
      .orderBy(desc(jobs.updatedAt))
      .limit(20),
    db
      .select({ value: count(jobs.id) })
      .from(jobs)
      .where(
        and(
          or(eq(jobs.clientUserId, userId), eq(jobs.workerUserId, userId)),
          inArray(jobs.status, activeStatuses),
        ),
      ),
    db
      .select({ id: identityVerifications.id })
      .from(identityVerifications)
      .where(
        and(eq(identityVerifications.userId, userId), eq(identityVerifications.status, "VERIFIED")),
      )
      .limit(1),
    db
      .select({ id: wallets.id })
      .from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.status, "VERIFIED")))
      .limit(1),
    db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.actorUserId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(8),
    db
      .select({ id: jobs.id })
      .from(jobs)
      .where(or(eq(jobs.clientUserId, userId), eq(jobs.workerUserId, userId)))
      .limit(1),
    db
      .select({ id: jobListings.id })
      .from(jobListings)
      .where(eq(jobListings.clientUserId, userId))
      .limit(1),
    db
      .select({ id: proposals.id })
      .from(proposals)
      .where(eq(proposals.workerUserId, userId))
      .limit(1),
    db
      .select({ id: portfolioItems.id })
      .from(portfolioItems)
      .where(eq(portfolioItems.userId, userId))
      .limit(1),
    db
      .select({ isPublic: profiles.isPublic })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1),
    getUserFinancialSummary(userId),
    db
      .select({ value: count(jobs.id) })
      .from(jobs)
      .where(and(eq(jobs.workerUserId, userId), eq(jobs.status, "FUNDED_AWAITING_ACCEPTANCE"))),
    db
      .select({ value: count(milestones.id) })
      .from(milestones)
      .innerJoin(jobs, eq(milestones.jobId, jobs.id))
      .where(
        and(
          inArray(jobs.status, activeStatuses),
          or(
            and(
              eq(jobs.clientUserId, userId),
              inArray(milestones.status, ["PROOF_SUBMITTED", "UNDER_REVIEW"]),
            ),
            and(eq(jobs.workerUserId, userId), eq(milestones.status, "REVISION_REQUESTED")),
          ),
        ),
      ),
    db
      .select({
        id: jobs.id,
        jobId: jobs.id,
        detail: jobs.title,
        urgencyAt: sql<Date>`coalesce(${jobs.acceptanceExpiresAt}, ${jobs.updatedAt})`,
        createdAt: jobs.updatedAt,
      })
      .from(jobs)
      .where(and(eq(jobs.workerUserId, userId), eq(jobs.status, "FUNDED_AWAITING_ACCEPTANCE")))
      .orderBy(
        asc(sql`coalesce(${jobs.acceptanceExpiresAt}, ${jobs.updatedAt})`),
        asc(jobs.updatedAt),
        asc(jobs.id),
      )
      .limit(4),
    db
      .select({
        id: milestones.id,
        jobId: jobs.id,
        detail: jobs.title,
        note: milestones.title,
        status: milestones.status,
        urgencyAt: milestones.dueAt,
        createdAt: milestones.updatedAt,
      })
      .from(milestones)
      .innerJoin(jobs, eq(milestones.jobId, jobs.id))
      .where(
        and(
          inArray(jobs.status, activeStatuses),
          or(
            and(
              eq(jobs.clientUserId, userId),
              inArray(milestones.status, ["PROOF_SUBMITTED", "UNDER_REVIEW"]),
            ),
            and(eq(jobs.workerUserId, userId), eq(milestones.status, "REVISION_REQUESTED")),
          ),
        ),
      )
      .orderBy(asc(milestones.dueAt), asc(milestones.updatedAt), asc(milestones.id))
      .limit(4),
  ]);

  const jobIds = jobRows.map((job) => job.id);
  const profileIds = Array.from(
    new Set(
      jobRows
        .flatMap((job) => [job.clientUserId, job.workerUserId])
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const [milestoneRows, profileRows] = await Promise.all([
    jobIds.length ? db.select().from(milestones).where(inArray(milestones.jobId, jobIds)) : [],
    profileIds.length
      ? db
          .select({ userId: profiles.userId, displayName: profiles.displayName })
          .from(profiles)
          .where(inArray(profiles.userId, profileIds))
      : [],
  ]);
  const names = new Map(profileRows.map((profile) => [profile.userId, profile.displayName]));
  const milestonesByJob = new Map<string, typeof milestoneRows>();
  for (const milestone of milestoneRows) {
    const current = milestonesByJob.get(milestone.jobId) ?? [];
    current.push(milestone);
    milestonesByJob.set(milestone.jobId, current);
  }
  const pendingSummary = pendingActionSummary(
    invitationActionTotals[0]?.value ?? 0,
    milestoneActionTotals[0]?.value ?? 0,
    [
      ...invitationActions.map((action) => ({
        ...action,
        id: `job:${action.id}:accept`,
        title: "Accept funded invitation",
        note: "Your acceptance is required",
      })),
      ...milestoneActions.map((action) => ({
        ...action,
        id: `milestone:${action.id}`,
        title:
          action.status === "REVISION_REQUESTED"
            ? "Submit milestone revision"
            : "Review milestone proof",
      })),
    ],
  );
  return {
    verification: {
      email: emailVerified,
      identity: identityRows.length > 0,
      wallet: walletRows.length > 0,
    },
    jobs: jobRows.map((job) => {
      const role = job.clientUserId === userId ? ("CLIENT" as const) : ("WORKER" as const);
      const items = milestonesByJob.get(job.id) ?? [];
      const completed = items.filter((item) => item.status === "RELEASED").length;
      const actionTitle = pendingActionTitle(
        role,
        job.status,
        items.map((item) => item.status),
      );
      const counterpartyId = role === "CLIENT" ? job.workerUserId : job.clientUserId;
      return {
        id: job.id,
        reference: job.reference,
        title: job.title,
        role,
        counterparty: counterpartyId
          ? (names.get(counterpartyId) ?? "Klaveroq member")
          : "Not assigned",
        status: job.status,
        amount: job.subtotal,
        asset: job.asset,
        assetDecimals: job.assetDecimals,
        progress: `${completed} of ${items.length}`,
        nextAction: actionTitle ?? "No action required",
        updatedAt: job.updatedAt,
      };
    }),
    activeJobCount: activeJobTotals[0]?.value ?? 0,
    pendingActions: pendingSummary.pendingActions,
    pendingActionCount: pendingSummary.pendingActionCount,
    financials,
    isFirstTimeUser: isFirstTimeUser({
      hasAgreement: agreementHistory.length > 0,
      hasListing: listingHistory.length > 0,
      hasProposal: proposalHistory.length > 0,
      hasPortfolioItem: portfolioHistory.length > 0,
      profileIsPublic: ownProfile[0]?.isPublic ?? false,
    }),
    activity: activityRows.map((item) => ({
      id: item.id,
      title: item.action
        .split(".")
        .map((part) => part.replaceAll("_", " "))
        .join(" "),
      detail: `${item.entityType}${item.entityId ? ` · ${item.entityId}` : ""}`,
      createdAt: item.createdAt,
    })),
  };
}
