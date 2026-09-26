import { createHash } from "node:crypto";

type LogLevel = "info" | "warn" | "error";
type SafeFields = Record<string, string | number | boolean | null | undefined>;

function write(level: LogLevel, event: string, fields: SafeFields = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    service: "klaveroq-web",
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
  };
  const output = JSON.stringify(record);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.info(output);
}

export const log = {
  info: (event: string, fields?: SafeFields) => write("info", event, fields),
  warn: (event: string, fields?: SafeFields) => write("warn", event, fields),
  error: (event: string, fields?: SafeFields) => write("error", event, fields),
};

export async function reportException(
  error: unknown,
  context: { requestId: string; method?: string; path?: string },
) {
  const name = error instanceof Error ? error.name : "UnknownError";
  const fingerprint = createHash("sha256")
    .update(
      error instanceof Error ? `${error.name}:${error.stack ?? error.message}` : String(error),
    )
    .digest("hex")
    .slice(0, 16);
  log.error("api.unhandled_error", { ...context, errorName: name, fingerprint });

  const webhook = process.env.ERROR_MONITORING_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.ERROR_MONITORING_TOKEN
          ? { authorization: `Bearer ${process.env.ERROR_MONITORING_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ service: "klaveroq-web", name, fingerprint, ...context }),
      signal: AbortSignal.timeout(2_000),
    });
  } catch {
    log.warn("monitoring.delivery_failed", { requestId: context.requestId });
  }
}
