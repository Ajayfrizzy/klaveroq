import { and, eq } from "drizzle-orm";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { jobs, marketplaceReviews } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { reviewSubjectFor } from "@/features/reputation/server/access";
import { reviewInputSchema } from "@/features/reputation/server/schemas";

export const GET = withApi(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const { user } = await requireUser();
    const [engagement] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!engagement || ![engagement.clientUserId, engagement.workerUserId].includes(user.id))
      throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    const reviews = await db
      .select()
      .from(marketplaceReviews)
      .where(eq(marketplaceReviews.jobId, id));
    return Response.json({ data: reviews });
  },
);

export const POST = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const { user } = await requireUser();
    const [engagement] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!engagement) throw new ApiError(404, "JOB_NOT_FOUND", "Job was not found.");
    const subjectUserId = reviewSubjectFor(engagement, user.id);
    const [existing] = await db
      .select({ id: marketplaceReviews.id })
      .from(marketplaceReviews)
      .where(and(eq(marketplaceReviews.jobId, id), eq(marketplaceReviews.reviewerUserId, user.id)))
      .limit(1);
    if (existing)
      throw new ApiError(409, "REVIEW_ALREADY_SUBMITTED", "You already reviewed this engagement.");
    const input = reviewInputSchema.parse(await request.json());
    const [review] = await db
      .insert(marketplaceReviews)
      .values({
        jobId: id,
        reviewerUserId: user.id,
        subjectUserId,
        rating: input.rating,
        comment: input.comment || null,
      })
      .onConflictDoNothing()
      .returning();
    if (!review)
      throw new ApiError(409, "REVIEW_ALREADY_SUBMITTED", "You already reviewed this engagement.");
    await audit(request, {
      actorUserId: user.id,
      action: "marketplace.review_created",
      entityType: "marketplace_review",
      entityId: review.id,
      metadata: { jobId: id, subjectUserId },
    });
    return Response.json({ data: review }, { status: 201 });
  },
);
