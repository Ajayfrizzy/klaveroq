import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseErrorCode, isTransientDatabaseError, reportRenderFailure } from "./render-errors";
import { optionalOperation, requiredOperation } from "./operations";
import { ApiError } from "../http/errors";
import { onRequestError } from "@/instrumentation";

const requestId = "f4041e0e-0532-4aa2-9a5c-1c89a5a048c0";
const timeout = () =>
  new Error("SQL with postgresql://user:password@host/db and user@example.test", {
    cause: Object.assign(new Error("secret SQL parameters"), { code: "57014" }),
  });
beforeEach(() => {
  vi.stubEnv("ERROR_MONITORING_WEBHOOK_URL", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("privacy-safe render diagnostics", () => {
  it("records correlation, timestamp, fingerprint and nested database code without private error text", async () => {
    await reportRenderFailure(timeout(), {
      requestId,
      operation: "dashboard.activity",
      optional: true,
      durationMs: 753,
    });
    const record = JSON.parse(vi.mocked(console.error).mock.calls[0][0]);
    expect(record).toMatchObject({
      event: "server.render_failure",
      operation: "dashboard.activity",
      requestId,
      code: "57014",
      transient: true,
      durationMs: 753,
    });
    expect(record.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(JSON.stringify(record)).not.toMatch(/password|user@example|parameters|postgresql|stack/);
  });
  it("keeps platform diagnostics when webhook delivery fails", async () => {
    vi.stubEnv("ERROR_MONITORING_WEBHOOK_URL", "https://monitor.example.test");
    const fetch = vi.fn().mockRejectedValue(new Error("receiver offline"));
    vi.stubGlobal("fetch", fetch);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await reportRenderFailure(timeout(), { requestId, operation: "dashboard.activity" });
    expect(console.error).toHaveBeenCalled();
    expect(warning).toHaveBeenCalled();
    expect(fetch.mock.calls[0][1].body).not.toMatch(/password|user@example|postgresql|parameters/);
  });
  it("does not emit arbitrary error codes or invalid request identifiers", async () => {
    const error = Object.assign(new Error("private"), { code: "ALICE", digest: "private-token" });
    expect(databaseErrorCode(error)).toBeUndefined();
    await reportRenderFailure(error, { requestId: "user@example.test", operation: "rsc.render" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(
      /ALICE|private|user@example/,
    );
  });
  it("captures RSC digest without raw paths, search strings or authentication headers", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    await onRequestError(
      Object.assign(timeout(), { digest: "1899399340" }),
      {
        path: "/?token=private",
        method: "GET",
        headers: {
          "x-request-id": requestId,
          cookie: "session=secret",
          authorization: "Bearer secret",
        },
      },
      {
        routerKind: "App Router",
        routePath: "/page",
        routeType: "render",
        renderSource: "react-server-components",
        revalidateReason: undefined,
      },
    );
    const record = JSON.parse(vi.mocked(console.error).mock.calls[0][0]);
    expect(record).toMatchObject({ operation: "rsc.render", requestId, digest: "1899399340" });
    expect(JSON.stringify(record)).not.toMatch(/token|cookie|secret|authorization/);
  });
});
describe("essential versus optional operations", () => {
  it("recovers on the next render after an optional database timeout, with null rather than invented data", async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce(timeout())
      .mockResolvedValueOnce([{ id: "activity" }]);
    expect(await optionalOperation(requestId, "dashboard.activity", query)).toBeNull();
    expect(await optionalOperation(requestId, "dashboard.activity", query)).toEqual([
      { id: "activity" },
    ]);
  });
  it("does not swallow a critical timeout and sanitizes the error forwarded to Next", async () => {
    const result = requiredOperation(requestId, "auth.session", async () => {
      throw timeout();
    });
    await expect(result).rejects.toMatchObject({
      code: "57014",
      message: "Account information could not be loaded.",
    });
  });
  it("never turns authentication errors or schema errors into optional data", async () => {
    const auth = new ApiError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
    expect(isTransientDatabaseError(auth)).toBe(false);
    await expect(
      optionalOperation(requestId, "dashboard.wallet", async () => {
        throw auth;
      }),
    ).rejects.toBe(auth);
    const schema = Object.assign(new Error("missing table with private values"), { code: "42P01" });
    await expect(
      optionalOperation(requestId, "dashboard.activity", async () => {
        throw schema;
      }),
    ).rejects.toMatchObject({ code: "42P01" });
  });
});
