import { and, eq, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { notificationDeliveries } from "@/server/db/schema";
import { ApiError, withApi } from "@/server/http/errors";
import { resendEventStatuses, verifyResendWebhook } from "@/server/email/webhook";

export const POST = withApi(async (request: Request) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) throw new ApiError(503, "WEBHOOK_NOT_CONFIGURED", "Webhook unavailable.");
  const raw = await request.text();
  if (raw.length > 128_000) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Payload too large.");
  if (!verifyResendWebhook(raw, request.headers, secret))
    throw new ApiError(401, "INVALID_SIGNATURE", "Invalid webhook signature.");
  const event = z
    .object({
      type: z.string(),
      created_at: z.string().datetime({ offset: true }),
      data: z.object({ email_id: z.string().min(1) }),
    })
    .parse(JSON.parse(raw));
  const status = resendEventStatuses[event.type];
  if (!status) return Response.json({ received: true });
  const [delivery] = await db
    .select({ id: notificationDeliveries.id })
    .from(notificationDeliveries)
    .where(eq(notificationDeliveries.providerId, event.data.email_id));
  // A webhook can beat the send response's DB commit. Ask Resend to retry.
  if (!delivery)
    throw new ApiError(503, "RECEIPT_PENDING", "Delivery receipt is not available yet.");
  const occurredAt = new Date(event.created_at);
  const updated = await db
    .update(notificationDeliveries)
    .set({
      status,
      providerEventAt: occurredAt,
      updatedAt: new Date(),
      ...(status === "DELIVERED" ? { deliveredAt: occurredAt } : { lastError: event.type }),
    })
    .where(
      and(
        eq(notificationDeliveries.id, delivery.id),
        or(
          isNull(notificationDeliveries.providerEventAt),
          lt(notificationDeliveries.providerEventAt, occurredAt),
        ),
      ),
    )
    .returning({ id: notificationDeliveries.id });
  if (updated.length)
    await audit(request, {
      action: "email.provider_event",
      entityType: "email_delivery",
      entityId: delivery.id,
      metadata: { status },
    });
  return Response.json({ received: true });
});
