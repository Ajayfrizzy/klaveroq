import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeAuditMetadata } from "./audit";

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? routeFiles(path) : entry.name === "route.ts" ? [path] : [];
  });
}

describe("audit coverage", () => {
  it("requires every state-changing API route to record an audit event", () => {
    const apiRoot = join(process.cwd(), "src/app/api");
    // Lifecycle services commit their audit events in the SAME transaction as the
    // transition. These explicit routes delegate to that audited service.
    const delegated = new Set([
      "account/closure/route.ts",
      "account/recover/route.ts",
      "account/confirmation/route.ts",
      "admin/account-holds/route.ts",
    ]);
    expect(readFileSync(join(process.cwd(), "src/server/account/service.ts"), "utf8")).toContain(
      ".insert(auditLogs)",
    );
    const missing = routeFiles(apiRoot)
      .filter((path) => !delegated.has(path.replace(`${apiRoot}/`, "")))
      .filter((path) => /export const (POST|PUT|PATCH|DELETE)\b/.test(readFileSync(path, "utf8")))
      .filter((path) => !/\baudit\(/.test(readFileSync(path, "utf8")))
      .map((path) => path.replace(`${process.cwd()}/`, ""));
    expect(missing).toEqual([]);
  });

  it("redacts sensitive audit metadata and bounds free-form strings", () => {
    expect(
      sanitizeAuditMetadata({
        status: "CONFIRMED",
        password: "never-log-this",
        reason: "private explanation",
        reference: "x".repeat(300),
      }),
    ).toEqual({
      status: "CONFIRMED",
      password: "[REDACTED]",
      reason: "[REDACTED]",
      reference: "x".repeat(200),
    });
  });
});
