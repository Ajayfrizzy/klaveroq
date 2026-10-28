import { timingSafeEqual } from "node:crypto";
import { audit } from "@/server/audit";
import { ApiError, withApi } from "@/server/http/errors";
import { log } from "@/server/observability/logger";
import { runSettlementClaimIssuanceFromEnvironment } from "@/features/vellum/server/claims/runtime";

export const maxDuration = 300;

function requireCronCredential(request: Request): void {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (
    !secret ||
    secret.length < 32 ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    throw new ApiError(401, "CRON_UNAUTHORIZED", "A valid cron credential is required.");
  }
}

export const POST = withApi(async (request: Request) => {
  requireCronCredential(request);
  const outcome = await runSettlementClaimIssuanceFromEnvironment();
  log.info("vellum.settlement_claim_run", {
    status: outcome.status,
    ...(outcome.status !== "disabled"
      ? {
          issuanceId: outcome.issuanceId,
          transactionHash: outcome.transactionHash,
        }
      : {}),
  });
  await audit(request, {
    action: "internal.vellum_settlement_claim_retry",
    entityType: "vellum_claim_issuance",
    entityId: outcome.status !== "disabled" ? outcome.issuanceId : undefined,
    metadata: { status: outcome.status },
  });
  return Response.json({ data: outcome });
});
