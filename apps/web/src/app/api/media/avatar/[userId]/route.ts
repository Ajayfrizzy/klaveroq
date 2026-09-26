import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { mediaFiles, profiles } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { readPrivateFile } from "@/server/files/storage";

export const GET = withApi(
  async (_request: Request, context: { params: Promise<{ userId: string }> }) => {
    const current = await getCurrentUser();
    const { userId } = await context.params;
    const [record] = await db
      .select({ profile: profiles, media: mediaFiles })
      .from(profiles)
      .innerJoin(mediaFiles, eq(mediaFiles.storageKey, profiles.avatarKey))
      .where(and(eq(profiles.userId, userId), eq(mediaFiles.kind, "AVATAR")))
      .limit(1);
    if (
      !record ||
      (!record.profile.isPublic && current?.user.id !== userId) ||
      record.media.scanStatus !== "CLEAN"
    )
      throw new ApiError(404, "MEDIA_NOT_FOUND", "Media was not found.");
    return new Response(await readPrivateFile(record.media.storageKey), {
      headers: {
        "Content-Type": record.media.contentType,
        "Cache-Control": record.profile.isPublic ? "public, max-age=3600" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  },
);
