import { createHash } from "node:crypto";
import { log } from "./logger";

// Never log error messages, SQL, parameters, stack traces, raw URLs or headers.
const knownCodes = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECTION_DESTROYED",
  "CONNECTION_TIMEOUT",
  "57014",
  "55P03",
  "53300",
  "40001",
  "40P01",
  "57P01",
  "57P02",
  "57P03",
]);
const diagnosticCodes = new Set([
  ...knownCodes,
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  "42P01",
  "42703",
  "42501",
  "28P01",
  "28000",
  "XX000",
  "23505",
  "23503",
]);

export class ReportedRenderError extends Error {
  constructor(
    public readonly fingerprint: string,
    public readonly code?: string,
  ) {
    super("Account information could not be loaded.");
    this.name = "RenderDataError";
  }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function safeCorrelationId(value: unknown) {
  return typeof value === "string" && uuid.test(value) ? value : undefined;
}
export function safeDigest(error: unknown) {
  const value = error && typeof error === "object" && "digest" in error ? error.digest : undefined;
  return typeof value === "string" && /^\d{1,20}$/.test(value) ? value : undefined;
}
function causes(error: unknown) {
  const chain: Record<string, unknown>[] = [];
  const seen = new Set<unknown>();
  while (error && typeof error === "object" && !seen.has(error) && chain.length < 6) {
    seen.add(error);
    chain.push(error as Record<string, unknown>);
    error = (error as { cause?: unknown }).cause;
  }
  return chain;
}
export function databaseErrorCode(error: unknown) {
  for (const item of causes(error)) {
    const code = item.code;
    if (typeof code === "string" && diagnosticCodes.has(code)) return code;
  }
  return undefined;
}
export function isTransientDatabaseError(error: unknown) {
  // An auth error must never become an optional-section fallback, even with a nested timeout.
  if (causes(error).some((item) => item.status === 401 || item.status === 403)) return false;
  const code = databaseErrorCode(error);
  return Boolean(code && (knownCodes.has(code) || code.startsWith("08")));
}
export type RenderOperation =
  | "auth.session"
  | "rsc.render"
  | "dashboard.jobs"
  | "dashboard.job_totals"
  | "dashboard.identity"
  | "dashboard.wallet"
  | "dashboard.activity"
  | "dashboard.invitation_totals"
  | "dashboard.milestone_totals"
  | "dashboard.invitations"
  | "dashboard.milestone_actions"
  | "dashboard.job_milestones"
  | "dashboard.counterparties";

export async function reportRenderFailure(
  error: unknown,
  context: {
    requestId: string;
    operation: RenderOperation;
    durationMs?: number;
    optional?: boolean;
  },
) {
  const chain = causes(error);
  const code = databaseErrorCode(error);
  // Hash the full cause chain locally; only the fingerprint leaves this function.
  const fingerprint =
    error instanceof ReportedRenderError
      ? error.fingerprint
      : createHash("sha256")
          .update(
            chain
              .map(
                (item) =>
                  `${String(item.name ?? "Error")}:${String(item.stack ?? item.message ?? "")}`,
              )
              .join("\ncaused-by\n") || "UnknownError",
          )
          .digest("hex")
          .slice(0, 16);
  const errorName =
    error instanceof Error &&
    [
      "Error",
      "TypeError",
      "RangeError",
      "SyntaxError",
      "PostgresError",
      "DrizzleQueryError",
      "ApiError",
      "RenderDataError",
    ].includes(error.name)
      ? error.name
      : "UnknownError";
  const record = {
    timestamp: new Date().toISOString(),
    requestId: safeCorrelationId(context.requestId),
    operation: context.operation,
    durationMs: context.durationMs,
    optional: context.optional ?? false,
    fingerprint,
    errorName,
    digest: safeDigest(error),
    code,
    transient: isTransientDatabaseError(error),
  };
  // Platform logs are the primary diagnostic record, regardless of webhook availability.
  log.error("server.render_failure", record);
  if (process.env.ERROR_MONITORING_WEBHOOK_URL) {
    try {
      await fetch(process.env.ERROR_MONITORING_WEBHOOK_URL, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(2_000),
        headers: {
          "content-type": "application/json",
          ...(process.env.ERROR_MONITORING_TOKEN
            ? { authorization: `Bearer ${process.env.ERROR_MONITORING_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          service: "klaveroq-web",
          event: "server.render_failure",
          ...record,
        }),
      });
    } catch {
      log.warn("monitoring.delivery_failed", { requestId: record.requestId });
    }
  }
  return { fingerprint, code };
}
