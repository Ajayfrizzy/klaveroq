import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { securityHolds, wallets } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { audit } from "@/server/audit";

export const POST = withApi(async (request: Request) => {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    throw new ApiError(401, "CRON_UNAUTHORIZED", "A valid cron credential is required.");
  const holds = await db
    .select()
    .from(securityHolds)
    .where(
      and(
        eq(securityHolds.type, "PAYOUT_WALLET_CHANGE"),
        isNull(securityHolds.releasedAt),
        lte(securityHolds.expiresAt, new Date()),
      ),
    );
  let released = 0;
  const releasedHolds: string[] = [];
  for (const hold of holds)
    await db.transaction(async (tx) => {
      const walletId = hold.reason.split(" ").at(-1);
      if (!walletId) return;
      await tx
        .update(wallets)
        .set({ isDefaultPayout: false, updatedAt: new Date() })
        .where(eq(wallets.userId, hold.userId));
      await tx
        .update(wallets)
        .set({ status: "VERIFIED", isDefaultPayout: true, updatedAt: new Date() })
        .where(
          and(
            eq(wallets.id, walletId),
            eq(wallets.userId, hold.userId),
            eq(wallets.status, "LOCKED"),
          ),
        );
      await tx
        .update(securityHolds)
        .set({ releasedAt: new Date() })
        .where(eq(securityHolds.id, hold.id));
      released++;
      releasedHolds.push(hold.id);
    });
  for (const holdId of releasedHolds)
    await audit(request, {
      action: "internal.security_hold_released",
      entityType: "security_hold",
      entityId: holdId,
    });
  return Response.json({ data: { released } });
});
