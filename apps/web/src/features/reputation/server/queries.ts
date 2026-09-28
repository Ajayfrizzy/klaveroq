import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  identityVerifications,
  jobs,
  marketplaceReviews,
  milestones,
  proofSubmissions,
} from "@/server/db/schema";
import { calculateReputation } from "./metrics";
import { trustedIdentityProviders } from "@/server/identity/provider";

export type ReputationSummary = {
  averageRating: number | null;
  reviewCount: number;
  completedJobs: number;
  completedMilestones: number;
  onTimeRate: number | null;
  repeatClients: number;
  verifiedWorkCount: number;
  identityVerified: boolean;
};

export async function getReputationSummaries(userIds: string[]) {
  const uniqueIds = [...new Set(userIds)];
  const result = new Map<string, ReputationSummary>();
  if (!uniqueIds.length) return result;

  const [workRows, reviewRows, verificationRows] = await Promise.all([
    db
      .select({
        job: jobs,
        milestone: milestones,
        proofSubmittedAt: proofSubmissions.submittedAt,
      })
      .from(jobs)
      .leftJoin(milestones, eq(milestones.jobId, jobs.id))
      .leftJoin(
        proofSubmissions,
        and(eq(proofSubmissions.milestoneId, milestones.id), eq(proofSubmissions.version, 1)),
      )
      .where(and(inArray(jobs.workerUserId, uniqueIds), eq(jobs.status, "COMPLETED"))),
    db
      .select()
      .from(marketplaceReviews)
      .where(inArray(marketplaceReviews.subjectUserId, uniqueIds)),
    db
      .select({ userId: identityVerifications.userId })
      .from(identityVerifications)
      .where(
        and(
          inArray(identityVerifications.userId, uniqueIds),
          eq(identityVerifications.status, "VERIFIED"),
          inArray(identityVerifications.provider, trustedIdentityProviders()),
        ),
      ),
  ]);

  const jobsByWorker = new Map<string, Map<string, typeof jobs.$inferSelect>>();
  const milestonesByWorker = new Map<string, Array<{ dueAt: Date; submittedAt: Date | null }>>();
  const ratingsByUser = new Map<string, number[]>();
  for (const row of workRows) {
    if (!row.job.workerUserId) continue;
    const workerJobs = jobsByWorker.get(row.job.workerUserId) ?? new Map();
    workerJobs.set(row.job.id, row.job);
    jobsByWorker.set(row.job.workerUserId, workerJobs);
    if (row.milestone?.status === "RELEASED") {
      const workerMilestones = milestonesByWorker.get(row.job.workerUserId) ?? [];
      workerMilestones.push({
        dueAt: row.milestone.dueAt,
        submittedAt: row.proofSubmittedAt,
      });
      milestonesByWorker.set(row.job.workerUserId, workerMilestones);
    }
  }
  for (const review of reviewRows) {
    const ratings = ratingsByUser.get(review.subjectUserId) ?? [];
    ratings.push(review.rating);
    ratingsByUser.set(review.subjectUserId, ratings);
  }
  const verifiedUsers = new Set(verificationRows.map((row) => row.userId));
  for (const userId of uniqueIds)
    result.set(
      userId,
      calculateReputation({
        completedJobs: [...(jobsByWorker.get(userId)?.values() ?? [])],
        releasedMilestones: milestonesByWorker.get(userId) ?? [],
        ratings: ratingsByUser.get(userId) ?? [],
        identityVerified: verifiedUsers.has(userId),
      }),
    );
  return result;
}

export async function getReputationSummary(userId: string) {
  return (await getReputationSummaries([userId])).get(userId)!;
}
