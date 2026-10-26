import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { clientInvites, notificationDeliveries } from "@/server/db/schema";
import { audit } from "@/server/audit";

// The existing maintenance endpoint materializes expiry; reads enforce the deadline immediately.
export async function expireClientInvitations(request: Request) {
  return db.transaction(async (tx) => {
    const expired = await tx
      .update(clientInvites)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(and(eq(clientInvites.status, "PENDING"), lte(clientInvites.expiresAt, new Date())))
      .returning({ id: clientInvites.id, tokenHash: clientInvites.tokenHash });
    for (const invite of expired) {
      await tx
        .update(notificationDeliveries)
        .set({
          status: sql`case when ${notificationDeliveries.status} in ('PENDING', 'FAILED', 'PROCESSING') then 'EXPIRED' else ${notificationDeliveries.status} end`,
          textBody: "",
          htmlBody: "",
        })
        .where(eq(notificationDeliveries.tokenHash, invite.tokenHash));
      await audit(
        request,
        { action: "client_invite.expired", entityType: "client_invite", entityId: invite.id },
        tx,
      );
    }
    return expired.length;
  });
}
