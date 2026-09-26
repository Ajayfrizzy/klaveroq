import { db } from "./db";
import { auditLogs } from "./db/schema";
import { clientIpHash } from "./http/security";
import { getRequestId } from "./observability/request-context";

const sensitiveKey = /password|token|secret|signature|publicKey|address|email|body|note|reason/i;

export function sanitizeAuditMetadata(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      sensitiveKey.test(key)
        ? "[REDACTED]"
        : typeof value === "string"
          ? value.slice(0, 200)
          : value,
    ]),
  );
}

export async function audit(
  request: Request,
  input: {
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await db.insert(auditLogs).values({
    ...input,
    actorUserId: input.actorUserId ?? null,
    entityId: input.entityId ?? null,
    correlationId: getRequestId(request),
    ipHash: clientIpHash(request),
    metadata: sanitizeAuditMetadata({
      ...(input.actorUserId ? {} : { actorType: "SYSTEM" }),
      ...(input.metadata ?? {}),
    }),
  });
}
