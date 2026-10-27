import { ccc } from "@ckb-ccc/core";
import type { VellumSettlementClaimPayload } from "@/server/db/schema";

export type SettlementApprovalMethod = VellumSettlementClaimPayload["approval_method"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX32_PATTERN = /^0x[0-9a-f]{64}$/;
const UINT32_MAX = 4_294_967_295;
const PAYLOAD_KEYS = [
  "approval_method",
  "delivery_id",
  "engagement_id",
  "milestone_id",
  "milestone_sequence",
  "settled_at",
  "settlement_tx_hash",
] as const;

type PrivateReferenceKind = "delivery" | "engagement" | "milestone";

function hasExactKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value).sort();
  return (
    keys.length === PAYLOAD_KEYS.length && keys.every((key, index) => key === PAYLOAD_KEYS[index])
  );
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function privateSettlementReference(kind: PrivateReferenceKind, id: string): ccc.Hex {
  if (!UUID_PATTERN.test(id)) throw new TypeError(`Klaveroq ${kind} ID must be a UUID`);
  return ccc.hashCkb(
    ccc.bytesFrom(`klaveroq.milestone-settlement.v1:${kind}:${id.toLowerCase()}`, "utf8"),
  );
}

export function parseSettlementClaimPayload(value: unknown): VellumSettlementClaimPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Klaveroq milestone settlement claim payload must be an object");
  }
  const payload = value as Record<string, unknown>;
  if (
    !hasExactKeys(payload) ||
    typeof payload.engagement_id !== "string" ||
    !HEX32_PATTERN.test(payload.engagement_id) ||
    typeof payload.milestone_id !== "string" ||
    !HEX32_PATTERN.test(payload.milestone_id) ||
    typeof payload.delivery_id !== "string" ||
    !HEX32_PATTERN.test(payload.delivery_id) ||
    !isPositiveSafeInteger(payload.milestone_sequence) ||
    payload.milestone_sequence > UINT32_MAX ||
    (payload.approval_method !== "client" && payload.approval_method !== "review_timeout") ||
    !isPositiveSafeInteger(payload.settled_at) ||
    typeof payload.settlement_tx_hash !== "string" ||
    !HEX32_PATTERN.test(payload.settlement_tx_hash)
  ) {
    throw new TypeError("Klaveroq milestone settlement claim payload is invalid");
  }
  return payload as VellumSettlementClaimPayload;
}

export function buildSettlementClaimPayload(input: {
  approvalMethod: SettlementApprovalMethod;
  deliveryId: string;
  engagementId: string;
  milestoneId: string;
  milestoneSequence: number;
  settledAt: number;
  settlementTransactionHash: string;
}): VellumSettlementClaimPayload {
  return parseSettlementClaimPayload({
    engagement_id: privateSettlementReference("engagement", input.engagementId),
    milestone_id: privateSettlementReference("milestone", input.milestoneId),
    delivery_id: privateSettlementReference("delivery", input.deliveryId),
    milestone_sequence: input.milestoneSequence,
    approval_method: input.approvalMethod,
    settled_at: input.settledAt,
    settlement_tx_hash: input.settlementTransactionHash.toLowerCase(),
  });
}
