import { z } from "zod";

export const agreementStatuses = [
  "DRAFT",
  "INVITED",
  "AWAITING_FUNDING",
  "FUNDED_AWAITING_ACCEPTANCE",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "DECLINED",
  "EXPIRED",
  "CANCELLATION_PENDING",
  "CANCELLED",
  "DISPUTED",
  "SECURITY_HOLD",
  "REFUND_PENDING",
  "REFUNDED",
  "FAILED",
] as const;

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const jobWorkspaceQuerySchema = z.object({
  view: z.preprocess(
    blankToUndefined,
    z.enum(["agreements", "listings", "proposals"]).default("agreements"),
  ),
  query: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
  status: z.preprocess(blankToUndefined, z.enum(agreementStatuses).optional()),
});

export function agreementStatusLabel(status: (typeof agreementStatuses)[number]) {
  return status.toLowerCase().replaceAll("_", " ");
}
