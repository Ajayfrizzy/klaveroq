import { desc } from "drizzle-orm";
import { withApi } from "@/server/http/errors";
import { requireUser } from "@/server/auth/session";
import { requireRole } from "@/server/auth/authorization";
import { db } from "@/server/db";
import { accountClosures, accountHolds, accountPrivacyRequests } from "@/server/db/schema";
export const GET = withApi(async () => {
  const { user } = await requireUser();
  requireRole(user.systemRole, ["RISK_ADMIN", "SUPER_ADMIN"]);
  const [closures, holds, privacy] = await Promise.all([
    db.select().from(accountClosures).orderBy(desc(accountClosures.requestedAt)).limit(50),
    db.select().from(accountHolds).orderBy(desc(accountHolds.createdAt)).limit(50),
    db
      .select()
      .from(accountPrivacyRequests)
      .orderBy(desc(accountPrivacyRequests.createdAt))
      .limit(50),
  ]);
  return Response.json({ data: { closures, holds, privacy } });
});
