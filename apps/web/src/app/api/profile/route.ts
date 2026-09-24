import { desc, eq } from "drizzle-orm";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { portfolioItems, profiles } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { profileInputSchema } from "@/features/talent/server/schemas";
import { getMissingPublicationFields } from "@/features/talent/server/publication";

export const GET = withApi(async () => {
  const { user } = await requireUser();
  const [profile, portfolio] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1),
    db
      .select()
      .from(portfolioItems)
      .where(eq(portfolioItems.userId, user.id))
      .orderBy(desc(portfolioItems.createdAt)),
  ]);
  return Response.json({ data: { profile: profile[0] ?? null, portfolio } });
});

export const PATCH = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const input = profileInputSchema.parse(await request.json());
  const { makePrivateIfIncomplete = false, ...changes } = input;
  const [storedProfile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);
  if (!storedProfile)
    throw new ApiError(404, "PROFILE_NOT_FOUND", "Your professional profile was not found.");
  const candidate = { ...storedProfile, ...changes };
  const missingFields = getMissingPublicationFields(candidate);
  if (storedProfile.isPublic && missingFields.length && !makePrivateIfIncomplete)
    throw new ApiError(
      409,
      "PROFILE_WOULD_BE_INCOMPLETE",
      "These changes would make your public profile incomplete. Restore the required fields or save it as private.",
      { missingFields, canMakePrivate: true },
    );
  const makePrivate = storedProfile.isPublic && missingFields.length > 0 && makePrivateIfIncomplete;
  const [profile] = await db
    .update(profiles)
    .set({ ...changes, ...(makePrivate ? { isPublic: false } : {}), updatedAt: new Date() })
    .where(eq(profiles.userId, user.id))
    .returning();
  await audit(request, {
    actorUserId: user.id,
    action: makePrivate ? "profile.updated_and_made_private" : "profile.updated",
    entityType: "profile",
    entityId: user.id,
  });
  return Response.json({ data: profile });
});
