import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { operations, portfolioItems } from "@/server/db/schema";
import { withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { portfolioInputSchema } from "@/features/talent/server/schemas";
import { eq } from "drizzle-orm";
import { requireIdempotencyKey, scopedIdempotencyKey } from "@/server/http/idempotency";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const idempotencyKey = scopedIdempotencyKey(
    "create-portfolio",
    user.id,
    requireIdempotencyKey(request),
  );
  const [prior] = await db
    .select()
    .from(operations)
    .where(eq(operations.idempotencyKey, idempotencyKey))
    .limit(1);
  const priorItemId =
    prior?.metadata && typeof prior.metadata === "object" && "portfolioItemId" in prior.metadata
      ? String(prior.metadata.portfolioItemId)
      : null;
  if (priorItemId) {
    const [existing] = await db
      .select()
      .from(portfolioItems)
      .where(eq(portfolioItems.id, priorItemId))
      .limit(1);
    if (existing) return Response.json({ data: existing, idempotentReplay: true });
  }
  const input = portfolioInputSchema.parse(await request.json());
  const item = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(portfolioItems)
      .values({ ...input, userId: user.id })
      .returning();
    await tx.insert(operations).values({
      initiatedBy: user.id,
      type: "CREATE_PORTFOLIO_ITEM",
      idempotencyKey,
      status: "CONFIRMED",
      metadata: { portfolioItemId: created.id },
    });
    return created;
  });
  await audit(request, {
    actorUserId: user.id,
    action: "portfolio.created",
    entityType: "portfolio_item",
    entityId: item.id,
  });
  return Response.json({ data: item }, { status: 201 });
});
