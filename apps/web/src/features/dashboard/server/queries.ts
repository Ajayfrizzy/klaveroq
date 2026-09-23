import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/server/db";
import {
  auditLogs,
  identityVerifications,
  jobs,
  milestones,
  operations,
  profiles,
  wallets,
} from "@/server/db/schema";
import { confirmedFinancialSummary } from "./metrics";

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
  const [jobRows, identityRows, walletRows, activityRows] = await Promise.all([
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
  ]);

  const jobIds = jobRows.map((job) => job.id);
  const profileIds = Array.from(
    new Set(
      jobRows
        .flatMap((job) => [job.clientUserId, job.workerUserId])
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const [milestoneRows, operationRows, profileRows] = await Promise.all([
    jobIds.length ? db.select().from(milestones).where(inArray(milestones.jobId, jobIds)) : [],
    jobIds.length
      ? db
          .select()
          .from(operations)
          .where(inArray(operations.jobId, jobIds))
          .orderBy(desc(operations.createdAt))
      : [],
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
  const pendingActions = jobRows.flatMap((job) => {
    const role = job.clientUserId === userId ? "CLIENT" : "WORKER";
    const items = milestonesByJob.get(job.id) ?? [];
    if (role === "WORKER" && job.status === "FUNDED_AWAITING_ACCEPTANCE")
      return [
        {
          jobId: job.id,
          title: "Accept funded invitation",
          detail: job.title,
          note: "Your acceptance is required",
        },
      ];
    const waiting = items.find((item) =>
      role === "CLIENT"
        ? ["PROOF_SUBMITTED", "UNDER_REVIEW"].includes(item.status)
        : item.status === "REVISION_REQUESTED",
    );
    if (!waiting) return [];
    return [
      {
        jobId: job.id,
        title: role === "CLIENT" ? "Review milestone proof" : "Submit milestone revision",
        detail: job.title,
        note: waiting.title,
      },
    ];
  });
  const financials = confirmedFinancialSummary(operationRows);

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
      const action = pendingActions.find((item) => item.jobId === job.id);
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
        progress: `${completed} of ${items.length}`,
        nextAction: action?.title ?? "No action required",
        updatedAt: job.updatedAt,
      };
    }),
    pendingActions,
    financials,
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
