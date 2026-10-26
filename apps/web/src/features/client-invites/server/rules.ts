import { z } from "zod";

export const invitationSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((email) => email.toLowerCase()),
  projectTitle: z.string().trim().max(90).default(""),
  message: z.string().trim().max(2000).default(""),
});
export const invitationToken = z.string().regex(/^[a-f0-9]{64}$/);
export const invitationLifetime = 7 * 24 * 60 * 60 * 1000;
export function invitationStatus(invite: { status: string; expiresAt: Date }, now = new Date()) {
  return invite.status === "PENDING" && invite.expiresAt <= now ? "EXPIRED" : invite.status;
}
