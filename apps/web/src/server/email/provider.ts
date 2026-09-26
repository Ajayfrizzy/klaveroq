export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  async send(message: EmailMessage) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: this.from, ...message }),
    });
    if (!response.ok) throw new Error(`Email provider returned ${response.status}.`);
  }
}

export class LocalEmailProvider implements EmailProvider {
  async send() {
    // Local links are returned by auth APIs instead of logging sensitive tokens.
  }
}
