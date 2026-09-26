import { eq } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { notificationPreferences } from "@/server/db/schema";
import { withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";

const defaults = {
  proposalEmails: true,
  messageEmails: true,
  jobEmails: true,
  disputeEmails: true,
  supportEmails: true,
};

const schema = z.object({
  proposalEmails: z.boolean(),
  messageEmails: z.boolean(),
  jobEmails: z.boolean(),
  disputeEmails: z.boolean(),
  supportEmails: z.boolean(),
});

export const GET = withApi(async () => {
  const { user } = await requireUser();
  const [record] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, user.id))
    .limit(1);
  return Response.json({ data: record ? schema.parse(record) : defaults });
});

export const PUT = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const input = schema.parse(await request.json());
  const [record] = await db
    .insert(notificationPreferences)
    .values({ userId: user.id, ...input })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: { ...input, updatedAt: new Date() },
    })
    .returning();
  await audit(request, {
    actorUserId: user.id,
    action: "notification.preferences_updated",
    entityType: "user",
    entityId: user.id,
    metadata: input,
  });
  return Response.json({ data: schema.parse(record) });
});
