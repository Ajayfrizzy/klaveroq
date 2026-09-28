import { LocalEmailProvider, ResendEmailProvider } from "./provider";
import type { EmailMessage, EmailProvider } from "./provider";
import { allowsLocalAuthDelivery } from "../auth/local-mode";
import { emailAppUrl, emailTemplate, validEmailSender } from "./templates";

function provider(): EmailProvider {
  emailAppUrl();
  const name = process.env.EMAIL_PROVIDER ?? (process.env.NODE_ENV === "production" ? "" : "local");
  if (name === "local" && allowsLocalAuthDelivery()) return new LocalEmailProvider();
  if (
    name === "resend" &&
    process.env.RESEND_API_KEY &&
    process.env.EMAIL_FROM &&
    validEmailSender(process.env.EMAIL_FROM)
  )
    return new ResendEmailProvider(process.env.RESEND_API_KEY, process.env.EMAIL_FROM);
  throw new Error("Email delivery is not configured.");
}

export async function sendEmail(message: EmailMessage, idempotencyKey: string) {
  return provider().send(message, idempotencyKey);
}

const appUrl = emailAppUrl;

export function verificationUrl(token: string) {
  const url = new URL("/verify-email", appUrl());
  url.searchParams.set("token", token);
  return url.toString();
}

export function passwordResetUrl(token: string) {
  const url = new URL("/reset-password", appUrl());
  url.searchParams.set("token", token);
  return url.toString();
}

export async function sendVerificationEmail(email: string, token: string) {
  const url = verificationUrl(token);
  const { queueAuthEmail } = await import("./outbox");
  return queueAuthEmail(
    email,
    token,
    "VERIFY_EMAIL",
    emailTemplate(
      "Verify your Klaveroq email",
      "Verify your email to finish setting up your account. This link expires in 24 hours. If you did not create an account, ignore this message.",
      url,
      "Verify email",
    ),
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = passwordResetUrl(token);
  const { queueAuthEmail } = await import("./outbox");
  return queueAuthEmail(
    email,
    token,
    "RESET_PASSWORD",
    emailTemplate(
      "Reset your Klaveroq password",
      "A password reset was requested for your account. This link expires in one hour. Ignore this message if you did not request it.",
      url,
      "Reset password",
    ),
  );
}
