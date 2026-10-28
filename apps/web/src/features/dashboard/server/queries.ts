import { getRenderRequestId } from "@/server/observability/render-context";
import { optionalOperation, requiredOperation } from "@/server/observability/operations";
import { and, asc, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { describeActivity } from "@/features/activity/presentation";
import {
  auditLogs,
  identityVerifications,
  jobs,
  milestones,
  profiles,
  wallets,
} from "@/server/db/schema";
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
  const requestId = await getRenderRequestId();
  // Account/session has already succeeded. Keep core work errors fatal and named.
  // Six core reads first; optional sections cannot occupy the pool ahead of them.
  const [
    jobRows,
    activeJobTotals,
    invitationActionTotals,
    milestoneActionTotals,
    invitationActions,
    milestoneActions,
  ] = await Promise.all([
    requiredOperation(requestId, "dashboard.jobs", () =>
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
    ),
    requiredOperation(requestId, "dashboard.job_totals", () =>
      db
        .select({ value: count(jobs.id) })
        .from(jobs)
        .where(
          and(
            or(eq(jobs.clientUserId, userId), eq(jobs.workerUserId, userId)),
            inArray(jobs.status, activeStatuses),
          ),
        ),
    ),
    requiredOperation(requestId, "dashboard.invitation_totals", () =>
      db
        .select({ value: count(jobs.id) })
        .from(jobs)
        .where(and(eq(jobs.workerUserId, userId), eq(jobs.status, "FUNDED_AWAITING_ACCEPTANCE"))),
    ),
    requiredOperation(requestId, "dashboard.milestone_totals", () =>
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
    ),
    requiredOperation(requestId, "dashboard.invitations", () =>
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
    ),
    requiredOperation(requestId, "dashboard.milestone_actions", () =>
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
    ),
  ]);

  const jobIds = jobRows.map((job) => job.id);
  const profileIds = Array.from(
    new Set(
      jobRows
        .flatMap((job) => [job.clientUserId, job.workerUserId])
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const [milestoneRows, profileRows, identityRows, walletRows, activityRows] = await Promise.all([
    jobIds.length
      ? requiredOperation(requestId, "dashboard.job_milestones", () =>
          db.select().from(milestones).where(inArray(milestones.jobId, jobIds)),
        )
      : [],
    profileIds.length
      ? requiredOperation(requestId, "dashboard.counterparties", () =>
          db
            .select({ userId: profiles.userId, displayName: profiles.displayName })
            .from(profiles)
            .where(inArray(profiles.userId, profileIds)),
        )
      : [],
    optionalOperation(requestId, "dashboard.identity", () =>
      db
        .select({ id: identityVerifications.id })
        .from(identityVerifications)
        .where(
          and(
            eq(identityVerifications.userId, userId),
            eq(identityVerifications.status, "VERIFIED"),
            inArray(identityVerifications.provider, trustedIdentityProviders()),
          ),
        )
        .limit(1),
    ),
    optionalOperation(requestId, "dashboard.wallet", () =>
      db
        .select({ id: wallets.id })
        .from(wallets)
        .where(and(eq(wallets.userId, userId), eq(wallets.status, "VERIFIED")))
        .limit(1),
    ),
    optionalOperation(requestId, "dashboard.activity", () =>
      db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.actorUserId, userId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(8),
    ),
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
      identity: identityRows === null ? null : identityRows.length > 0,
      wallet: walletRows === null ? null : walletRows.length > 0,
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
    activity:
      activityRows?.map((item) => ({
        id: item.id,
        title: describeActivity(item.action),
        detail: "Account activity",
        createdAt: item.createdAt,
      })) ?? null,
  };
}
import { trustedIdentityProviders } from "@/server/identity/provider";
