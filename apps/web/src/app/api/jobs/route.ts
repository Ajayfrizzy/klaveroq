import { and, desc, eq, gt, or } from "drizzle-orm";
import { db } from "@/server/db";
import { feeQuotes, jobs, milestones, operations, profiles, users } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { createJobSchema } from "@/features/jobs/server/schemas";
import { serialize } from "@/server/serialize";
import { audit } from "@/server/audit";
import { createJobReference } from "@/server/references";

export const GET = withApi(async () => {
  const { user } = await requireUser();
  const records = await db
    .select()
    .from(jobs)
    .where(or(eq(jobs.clientUserId, user.id), eq(jobs.workerUserId, user.id)))
    .orderBy(desc(jobs.updatedAt));
  return Response.json({ data: serialize(records) });
});

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const input = createJobSchema.parse(await request.json());
  const suppliedKey = request.headers.get("idempotency-key");
  if (!suppliedKey || suppliedKey.length > 100)
    throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Provide a valid Idempotency-Key header.");
  const idempotencyKey = `create-job:${user.id}:${suppliedKey}`;
  const [prior] = await db
    .select()
    .from(operations)
    .where(eq(operations.idempotencyKey, idempotencyKey))
    .limit(1);
  if (prior?.jobId) {
    const [existing] = await db.select().from(jobs).where(eq(jobs.id, prior.jobId)).limit(1);
    if (existing) return Response.json({ data: serialize(existing), idempotentReplay: true });
  }
  const subtotal = input.milestones.reduce((sum, milestone) => sum + BigInt(milestone.amount), 0n);
  const [quote] = await db
    .select()
    .from(feeQuotes)
    .where(
      and(
        eq(feeQuotes.id, input.feeQuoteId),
        eq(feeQuotes.userId, user.id),
        eq(feeQuotes.asset, input.asset),
        gt(feeQuotes.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!quote || quote.subtotal !== subtotal)
    throw new ApiError(
      409,
      "FEE_QUOTE_INVALID",
      "Create a new fee quote for the exact milestone subtotal.",
    );
  const [worker] = input.workerUserId
    ? await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .innerJoin(profiles, eq(profiles.userId, users.id))
        .where(
          and(
            eq(users.id, input.workerUserId),
            eq(users.status, "ACTIVE"),
            eq(profiles.isPublic, true),
            or(eq(profiles.availability, "AVAILABLE"), eq(profiles.availability, "LIMITED")),
          ),
        )
        .limit(1)
    : await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.email, input.workerEmail!))
        .limit(1);
  if (input.workerUserId && !worker)
    throw new ApiError(404, "TALENT_NOT_FOUND", "The selected professional is unavailable.");
  if (worker?.id === user.id)
    throw new ApiError(
      400,
      "SELF_HIRING_NOT_ALLOWED",
      "Client and worker must be different accounts.",
    );
  const reference = createJobReference();
  const job = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(jobs)
      .values({
        reference,
        clientUserId: user.id,
        workerUserId: worker?.id,
        workerEmail: worker?.email ?? input.workerEmail!,
        title: input.title,
        description: input.description,
        asset: input.asset,
        assetDecimals: input.assetDecimals,
        subtotal,
        clientFee: quote.clientFee,
        workerFeeBps: 200,
        networkReserve: quote.networkReserve,
        status: "INVITED",
      })
      .returning();
    await tx.insert(milestones).values(
      input.milestones.map((milestone, index) => ({
        jobId: created.id,
        sequence: index + 1,
        title: milestone.title,
        description: milestone.description,
        acceptanceCriteria: milestone.acceptanceCriteria,
        amount: BigInt(milestone.amount),
        dueAt: milestone.dueAt,
        evidenceRequirements: milestone.evidenceRequirements,
      })),
    );
    await tx.insert(operations).values({
      jobId: created.id,
      initiatedBy: user.id,
      type: "CREATE_JOB",
      idempotencyKey,
      status: "CONFIRMED",
      metadata: { reference },
    });
    return created;
  });
  await audit(request, {
    actorUserId: user.id,
    action: "job.created",
    entityType: "job",
    entityId: job.id,
    metadata: { reference },
  });
  return Response.json({ data: serialize(job) }, { status: 201 });
});
