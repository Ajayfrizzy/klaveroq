import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { proofSubmissions, revisionRequests, milestones } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { requireMilestoneParticipant } from "@/features/jobs/server/access";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { audit } from "@/server/audit";
import { serialize } from "@/server/serialize";

const schema = z.object({
  note: z.string().trim().min(10).max(5000),
  links: z.array(z.string().url()).max(10).default([]),
});

export const POST = withApi(
  async (request: Request, context: RouteContext<"/api/milestones/[id]/proofs">) => {
    assertSameOrigin(request);
    const { user } = await requireUser();
    const { id } = await context.params;
    const { milestone, role } = await requireMilestoneParticipant(id, user.id);
    if (role !== "WORKER")
      throw new ApiError(403, "WORKER_ONLY", "Only the assigned worker can submit proof.");
    if (!["ACTIVE", "REVISION_REQUESTED"].includes(milestone.status))
      throw new ApiError(409, "MILESTONE_STATE_INVALID", "This milestone is not accepting proof.");
    const input = schema.parse(await request.json());
    const [versionRow] = await db
      .select({ value: count() })
      .from(proofSubmissions)
      .where(eq(proofSubmissions.milestoneId, id));
    const reviewDeadline = new Date(Date.now() + milestone.reviewPeriodDays * 86_400_000);
    const [proof] = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(milestones)
        .set({ status: "UNDER_REVIEW", updatedAt: new Date() })
        .where(
          and(eq(milestones.id, id), inArray(milestones.status, ["ACTIVE", "REVISION_REQUESTED"])),
        )
        .returning({ id: milestones.id });
      if (!claimed)
        throw new ApiError(
          409,
          "MILESTONE_STATE_INVALID",
          "Another proof submission already changed this milestone.",
        );
      const created = await tx
        .insert(proofSubmissions)
        .values({
          milestoneId: id,
          submittedBy: user.id,
          version: Number(versionRow.value) + 1,
          note: input.note,
          links: input.links,
          reviewDeadline,
        })
        .returning();
      await tx
        .update(revisionRequests)
        .set({ resolvedAt: new Date() })
        .where(and(eq(revisionRequests.milestoneId, id), isNull(revisionRequests.resolvedAt)));
      return created;
    });
    await audit(request, {
      actorUserId: user.id,
      action: "proof.submitted",
      entityType: "proof",
      entityId: proof.id,
      metadata: { milestoneId: id, version: proof.version },
    });
    return Response.json({ data: serialize(proof) }, { status: 201 });
  },
);
