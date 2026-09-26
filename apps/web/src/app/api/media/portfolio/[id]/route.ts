import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { mediaFiles, portfolioItems, profiles } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { readPrivateFile } from "@/server/files/storage";

export const GET = withApi(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const current = await getCurrentUser();
    const { id } = await context.params;
    const [record] = await db
      .select({ item: portfolioItems, profile: profiles, media: mediaFiles })
      .from(portfolioItems)
      .innerJoin(profiles, eq(profiles.userId, portfolioItems.userId))
      .innerJoin(mediaFiles, eq(mediaFiles.storageKey, portfolioItems.mediaKey))
      .where(and(eq(portfolioItems.id, id), eq(mediaFiles.kind, "PORTFOLIO")))
      .limit(1);
    if (
      !record ||
      (!record.profile.isPublic && current?.user.id !== record.item.userId) ||
      record.media.scanStatus !== "CLEAN"
    )
      throw new ApiError(404, "MEDIA_NOT_FOUND", "Media was not found.");
    const disposition = record.media.contentType === "application/pdf" ? "attachment" : "inline";
    return new Response(await readPrivateFile(record.media.storageKey), {
      headers: {
        "Content-Type": record.media.contentType,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(record.media.originalName)}`,
        "Cache-Control": record.profile.isPublic ? "public, max-age=3600" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  },
);
