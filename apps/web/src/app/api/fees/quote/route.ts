import { db } from "@/server/db";
import { feeQuotes } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import {
  calculateFees,
  parseSmallestUnit,
  serializeFees,
} from "@/features/payments/server/fee-engine";
import { feeQuoteSchema } from "@/features/jobs/server/schemas";
import { withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { audit } from "@/server/audit";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const input = feeQuoteSchema.parse(await request.json());
  const fees = calculateFees(parseSmallestUnit(input.subtotal));
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  const [quote] = await db
    .insert(feeQuotes)
    .values({
      userId: user.id,
      asset: input.asset,
      subtotal: fees.subtotal,
      clientFee: fees.clientFee,
      workerFee: fees.workerFee,
      networkReserve: fees.networkReserve,
      totalFunding: fees.totalFunding,
      workerNet: fees.workerNet,
      policyVersion: fees.policyVersion,
      expiresAt,
    })
    .returning();
  await audit(request, {
    actorUserId: user.id,
    action: "fee_quote.created",
    entityType: "fee_quote",
    entityId: quote.id,
    metadata: { asset: input.asset, policyVersion: fees.policyVersion },
  });
  return Response.json(
    { data: { id: quote.id, ...serializeFees(fees), asset: input.asset, expiresAt } },
    { status: 201 },
  );
});
