import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, withApi } from "./errors";

afterEach(() => vi.restoreAllMocks());

describe("API response tracing", () => {
  const requestId = "f4041e0e-0532-4aa2-9a5c-1c89a5a048c0";
  const request = () =>
    new Request("http://localhost/api/auth/google", {
      headers: { "x-request-id": requestId },
    });

  it("preserves an immutable OAuth redirect instead of returning 500", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const destination = "https://accounts.google.com/o/oauth2/v2/auth?state=test";
    const handler = withApi(async (_request: Request) => Response.redirect(destination));
    const response = await handler(request());
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(destination);
    expect(response.headers.get("x-request-id")).toBe(requestId);
  });

  it("preserves the body, status and separate authentication cookies", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const headers = new Headers({ "content-type": "application/json" });
    headers.append("set-cookie", "session=one; Path=/; HttpOnly");
    headers.append("set-cookie", "nonce=two; Path=/api/auth/google; HttpOnly");
    const handler = withApi(
      async (_request: Request) => new Response('{"ok":true}', { status: 201, headers }),
    );
    const response = await handler(request());
    expect(response.status).toBe(201);
    expect(response.headers.getSetCookie()).toEqual(headers.getSetCookie());
    expect(await response.json()).toEqual({ ok: true });
  });

  it("retains structured errors and request IDs", async () => {
    const handler = withApi(async (_request: Request): Promise<Response> => {
      throw new ApiError(403, "FORBIDDEN", "Access denied.");
    });
    const response = await handler(request());
    expect(response.status).toBe(403);
    expect(response.headers.get("x-request-id")).toBe(requestId);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });
});
