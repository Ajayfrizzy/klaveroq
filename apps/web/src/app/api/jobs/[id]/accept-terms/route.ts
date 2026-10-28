import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { clientInvites, jobs, notifications } from "@/server/db/schema";
import { inviteUser } from "@/features/client-invites/server/service";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { audit } from "@/server/audit";

// Terms consent only: never invoke funded acceptance, wallets, milestones or PactAgent.
export const POST = withApi(
  async (request: Request, context: RouteContext<"/api/jobs/[id]/accept-terms">) => {
    assertSameOrigin(request);
    const id = z
      .string()
      .uuid()
      .parse((await context.params).id);
    const { user } = await inviteUser();
    await db.transaction(async (tx) => {
      const [invite] = await tx
        .select()
        .from(clientInvites)
        .where(
          and(
            eq(clientInvites.jobId, id),
            eq(clientInvites.ownerUserId, user.id),
            eq(clientInvites.status, "ACCEPTED"),
          ),
        );
      if (!invite) throw new ApiError(404, "JOB_NOT_FOUND", "Agreement was not found.");
      const [job] = await tx
        .update(jobs)
        .set({ termsAcceptedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(jobs.id, id),
            eq(jobs.workerUserId, user.id),
            eq(jobs.status, "INVITED"),
            isNull(jobs.termsAcceptedAt),
          ),
        )
        .returning();
      if (!job)
        throw new ApiError(
          409,
          "TERMS_STATE_CONFLICT",
          "Terms are already accepted or this agreement is no longer available for review.",
        );
      await tx.insert(notifications).values({
        userId: job.clientUserId,
        type: "AGREEMENT_TERMS_ACCEPTED",
        title: "Agreement terms accepted",
        body: "Your freelancer accepted the agreement terms. No payment has been initiated.",
        href: `/jobs/${id}`,
        dedupeKey: `agreement-terms:${id}`,
      });
      await audit(
        request,
        { actorUserId: user.id, action: "job.terms_accepted", entityType: "job", entityId: id },
        tx,
      );
    });
    return Response.json({ data: { accepted: true } });
  },
);
