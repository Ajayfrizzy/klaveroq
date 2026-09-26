import { afterEach, describe, expect, it, vi } from "vitest";
import { passwordResetUrl, verificationUrl } from ".";
import { ResendEmailProvider } from "./provider";

afterEach(() => vi.unstubAllGlobals());

describe("authentication email links", () => {
  it("builds same-origin verification and recovery links", () => {
    expect(new URL(verificationUrl("verify-token"))).toMatchObject({
      origin: "http://127.0.0.1:3000",
      pathname: "/verify-email",
      search: "?token=verify-token",
    });
    expect(new URL(passwordResetUrl("reset-token"))).toMatchObject({
      origin: "http://127.0.0.1:3000",
      pathname: "/reset-password",
      search: "?token=reset-token",
    });
  });

  it("sends the expected payload through the production provider", async () => {
    const request = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => {
      void _input;
      void _init;
      return new Response(null, { status: 202 });
    });
    vi.stubGlobal("fetch", request);
    await new ResendEmailProvider("api-key", "Klaveroq <accounts@example.com>").send({
      to: "user@example.com",
      subject: "Subject",
      text: "Text",
      html: "<p>Text</p>",
    });
    expect(request).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer api-key" }),
      }),
    );
    const [, init] = request.mock.calls[0]!;
    expect(JSON.parse(init?.body as string)).toMatchObject({
      from: "Klaveroq <accounts@example.com>",
      to: "user@example.com",
      subject: "Subject",
    });
  });
});
