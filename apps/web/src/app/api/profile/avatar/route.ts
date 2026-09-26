import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { mediaFiles, profiles } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { deletePrivateFile, MAX_AVATAR_BYTES, storePrivateFile } from "@/server/files/storage";

const imageTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const current = await requireUser();
  if (!current.profile) throw new ApiError(404, "PROFILE_NOT_FOUND", "Your profile was not found.");
  const form = await request.formData();
  const file = form.get("file");
  const altText = z
    .string()
    .trim()
    .max(500)
    .parse(form.get("altText") ?? "");
  if (!(file instanceof File)) throw new ApiError(400, "FILE_REQUIRED", "Choose an image.");
  const stored = await storePrivateFile(file, {
    allowedTypes: [...imageTypes],
    maxBytes: MAX_AVATAR_BYTES,
  });
  const priorKey = current.profile.avatarKey;
  try {
    await db.transaction(async (tx) => {
      await tx.insert(mediaFiles).values({
        ownerUserId: current.user.id,
        kind: "AVATAR",
        ...stored,
        originalName: file.name.slice(0, 255),
        altText: altText || `${current.profile!.displayName} profile photo`,
      });
      await tx
        .update(profiles)
        .set({ avatarKey: stored.storageKey, updatedAt: new Date() })
        .where(eq(profiles.userId, current.user.id));
      if (priorKey)
        await tx
          .delete(mediaFiles)
          .where(
            and(eq(mediaFiles.storageKey, priorKey), eq(mediaFiles.ownerUserId, current.user.id)),
          );
    });
  } catch (error) {
    await deletePrivateFile(stored.storageKey);
    throw error;
  }
  if (priorKey) await deletePrivateFile(priorKey);
  await audit(request, {
    actorUserId: current.user.id,
    action: priorKey ? "profile.avatar_replaced" : "profile.avatar_uploaded",
    entityType: "profile",
    entityId: current.user.id,
  });
  return Response.json(
    {
      data: {
        url: `/api/media/avatar/${current.user.id}?v=${Date.now()}`,
        altText: altText || `${current.profile.displayName} profile photo`,
        contentType: stored.contentType,
      },
    },
    { status: 201 },
  );
});

export const DELETE = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const current = await requireUser();
  const priorKey = current.profile?.avatarKey;
  if (!priorKey) return new Response(null, { status: 204 });
  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({ avatarKey: null, updatedAt: new Date() })
      .where(eq(profiles.userId, current.user.id));
    await tx
      .delete(mediaFiles)
      .where(and(eq(mediaFiles.storageKey, priorKey), eq(mediaFiles.ownerUserId, current.user.id)));
  });
  await deletePrivateFile(priorKey);
  await audit(request, {
    actorUserId: current.user.id,
    action: "profile.avatar_deleted",
    entityType: "profile",
    entityId: current.user.id,
  });
  return new Response(null, { status: 204 });
});
