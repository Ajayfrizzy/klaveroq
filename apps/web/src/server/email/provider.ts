export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface EmailProvider {
  send(message: EmailMessage, idempotencyKey: string): Promise<EmailReceipt>;
}

export type EmailReceipt = { status: "SIMULATED" | "ACCEPTED"; providerId?: string };

export class EmailProviderError extends Error {
  constructor(
    public code: string,
    public permanent = false,
    public retryAfterMs = 0,
  ) {
    super(code);
  }
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  async send(message: EmailMessage, idempotencyKey: string): Promise<EmailReceipt> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ from: this.from, ...message }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const retryAfter = response.headers.get("retry-after");
      const delay =
        retryAfter && /^\d+$/.test(retryAfter)
          ? Number(retryAfter) * 1000
          : Math.max(0, Date.parse(retryAfter ?? "") - Date.now()) || 0;
      throw new EmailProviderError(
        `RESEND_HTTP_${response.status}`,
        response.status >= 400 &&
          response.status < 500 &&
          ![408, 429].includes(response.status) &&
          !(response.status === 409 && errorBody.name === "concurrent_idempotent_requests"),
        delay,
      );
    }
    const body = await response.json();
    if (typeof body.id !== "string" || !body.id)
      throw new EmailProviderError("RESEND_INVALID_RECEIPT");
    return { status: "ACCEPTED", providerId: body.id };
  }
}

export class LocalEmailProvider implements EmailProvider {
  async send(): Promise<EmailReceipt> {
    // Local links are returned by auth APIs instead of logging sensitive tokens.
    return { status: "SIMULATED" };
  }
}
