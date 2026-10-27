import { randomUUID } from "node:crypto";
import type { SettlementClaimEnvironment } from "./config";
import { settlementClaimConfiguration } from "./config";
import { findSettlementClaimEvidence } from "./candidate";
import { broadcastPreparedSettlementClaim, prepareSettlementClaim } from "./issuer";
import { runSettlementClaimIssuance, type SettlementClaimRunResult } from "./service";
import { DatabaseSettlementClaimStore } from "./store";
import { vellumClient } from "@/features/vellum/server/identity";

export type SettlementClaimRuntimeResult = { status: "disabled" } | SettlementClaimRunResult;

export async function runSettlementClaimIssuanceFromEnvironment(
  environment: SettlementClaimEnvironment = process.env,
): Promise<SettlementClaimRuntimeResult> {
  const configuration = settlementClaimConfiguration(environment);
  if (!configuration.enabled) return { status: "disabled" };

  const client = vellumClient(environment);
  return runSettlementClaimIssuance(configuration, {
    broadcast: broadcastPreparedSettlementClaim,
    client,
    findEvidence: findSettlementClaimEvidence,
    now: () => new Date(),
    prepare: prepareSettlementClaim,
    store: new DatabaseSettlementClaimStore(),
    token: randomUUID,
  });
}
