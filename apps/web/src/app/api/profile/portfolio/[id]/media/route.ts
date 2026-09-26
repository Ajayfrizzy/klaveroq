import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { mediaFiles, portfolioItems } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { deletePrivateFile, storePrivateFile } from "@/server/files/storage";
import { requirePortfolioOwner } from "@/features/talent/server/access";

const mediaTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export const POST = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const { user } = await requireUser();
    const { id } = await context.params;
    const item = await requirePortfolioOwner(id, user.id);
    const form = await request.formData();
    const file = form.get("file");
    const altText = z.string().trim().min(3).max(500).parse(form.get("altText"));
    if (!(file instanceof File)) throw new ApiError(400, "FILE_REQUIRED", "Choose a media file.");
    const stored = await storePrivateFile(file, { allowedTypes: [...mediaTypes] });
    try {
      await db.transaction(async (tx) => {
        await tx.insert(mediaFiles).values({
          ownerUserId: user.id,
          kind: "PORTFOLIO",
          ...stored,
          originalName: file.name.slice(0, 255),
          altText,
        });
        await tx
          .update(portfolioItems)
          .set({ mediaKey: stored.storageKey, updatedAt: new Date() })
          .where(and(eq(portfolioItems.id, id), eq(portfolioItems.userId, user.id)));
        if (item.mediaKey)
          await tx
            .delete(mediaFiles)
            .where(
              and(eq(mediaFiles.storageKey, item.mediaKey), eq(mediaFiles.ownerUserId, user.id)),
            );
      });
    } catch (error) {
      await deletePrivateFile(stored.storageKey);
      throw error;
    }
    if (item.mediaKey) await deletePrivateFile(item.mediaKey);
    await audit(request, {
      actorUserId: user.id,
      action: item.mediaKey ? "portfolio.media_replaced" : "portfolio.media_uploaded",
      entityType: "portfolio_item",
      entityId: id,
    });
    return Response.json(
      {
        data: {
          url: `/api/media/portfolio/${id}?v=${Date.now()}`,
          altText,
          contentType: stored.contentType,
        },
      },
      { status: 201 },
    );
  },
);

export const DELETE = withApi(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(request);
    const { user } = await requireUser();
    const { id } = await context.params;
    const item = await requirePortfolioOwner(id, user.id);
    if (!item.mediaKey) return new Response(null, { status: 204 });
    await db.transaction(async (tx) => {
      await tx
        .update(portfolioItems)
        .set({ mediaKey: null, updatedAt: new Date() })
        .where(and(eq(portfolioItems.id, id), eq(portfolioItems.userId, user.id)));
      await tx
        .delete(mediaFiles)
        .where(and(eq(mediaFiles.storageKey, item.mediaKey!), eq(mediaFiles.ownerUserId, user.id)));
    });
    await deletePrivateFile(item.mediaKey);
    await audit(request, {
      actorUserId: user.id,
      action: "portfolio.media_deleted",
      entityType: "portfolio_item",
      entityId: id,
    });
    return new Response(null, { status: 204 });
  },
);
