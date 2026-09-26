import { LocalEmailProvider, ResendEmailProvider } from "./provider";
import type { EmailMessage, EmailProvider } from "./provider";
import { allowsLocalAuthDelivery } from "../auth/local-mode";

function provider(): EmailProvider {
  const name = process.env.EMAIL_PROVIDER ?? (process.env.NODE_ENV === "production" ? "" : "local");
  if (name === "local" && allowsLocalAuthDelivery()) return new LocalEmailProvider();
  if (name === "resend" && process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
    return new ResendEmailProvider(process.env.RESEND_API_KEY, process.env.EMAIL_FROM);
  throw new Error("Email delivery is not configured.");
}

export async function sendEmail(message: EmailMessage) {
  await provider().send(message);
}

const appUrl = () => process.env.APP_URL ?? "http://127.0.0.1:3000";

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

export function sendVerificationEmail(email: string, token: string) {
  const url = verificationUrl(token);
  return sendEmail({
    to: email,
    subject: "Verify your Klaveroq email",
    text: `Verify your Klaveroq email: ${url}\n\nThis link expires in 24 hours.`,
    html: `<p>Verify your Klaveroq email to finish setting up your account.</p><p><a href="${url}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
  });
}

export function sendPasswordResetEmail(email: string, token: string) {
  const url = passwordResetUrl(token);
  return sendEmail({
    to: email,
    subject: "Reset your Klaveroq password",
    text: `Reset your Klaveroq password: ${url}\n\nThis link expires in one hour.`,
    html: `<p>A password reset was requested for your Klaveroq account.</p><p><a href="${url}">Reset password</a></p><p>This link expires in one hour. Ignore this message if you did not request it.</p>`,
  });
}
