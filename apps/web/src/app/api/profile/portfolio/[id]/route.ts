import { eq } from "drizzle-orm";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { mediaFiles, portfolioItems } from "@/server/db/schema";
import { withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { requirePortfolioOwner } from "@/features/talent/server/access";
import { portfolioInputSchema } from "@/features/talent/server/schemas";
import { deletePrivateFile } from "@/server/files/storage";

export const PATCH = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const { user } = await requireUser();
    await requirePortfolioOwner(id, user.id);
    const input = portfolioInputSchema.parse(await request.json());
    const [item] = await db
      .update(portfolioItems)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(portfolioItems.id, id))
      .returning();
    await audit(request, {
      actorUserId: user.id,
      action: "portfolio.updated",
      entityType: "portfolio_item",
      entityId: id,
    });
    return Response.json({ data: item });
  },
);

export const DELETE = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const { user } = await requireUser();
    const item = await requirePortfolioOwner(id, user.id);
    await db.transaction(async (tx) => {
      await tx.delete(portfolioItems).where(eq(portfolioItems.id, id));
      if (item.mediaKey)
        await tx.delete(mediaFiles).where(eq(mediaFiles.storageKey, item.mediaKey));
    });
    if (item.mediaKey) await deletePrivateFile(item.mediaKey);
    await audit(request, {
      actorUserId: user.id,
      action: "portfolio.deleted",
      entityType: "portfolio_item",
      entityId: id,
    });
    return Response.json({ data: { id, deleted: true } });
  },
);
