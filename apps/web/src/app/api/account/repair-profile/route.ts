import { audit } from "@/server/audit";
import { z } from "zod";
import { db } from "@/server/db";
import { profiles } from "@/server/db/schema";
import { withApi } from "@/server/http/errors";
import { requireUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/http/security";
export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const { displayName } = z
    .object({ displayName: z.string().trim().min(2).max(100) })
    .parse(await request.json());
  await db.transaction(async (tx) => {
    const added = await tx
      .insert(profiles)
      .values({ userId: user.id, displayName, isPublic: false })
      .onConflictDoNothing()
      .returning();
    if (added.length)
      await audit(
        request,
        {
          actorUserId: user.id,
          action: "profile.recreated_private",
          entityType: "profile",
          entityId: user.id,
        },
        tx,
      );
  });
  return Response.json({ data: { repaired: true } });
});
