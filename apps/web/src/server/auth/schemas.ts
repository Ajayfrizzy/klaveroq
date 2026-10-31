import { z } from "zod";
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "@/features/auth/password-policy";

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH)
  .regex(/[a-z]/, "Use a lowercase letter")
  .regex(/[A-Z]/, "Use an uppercase letter")
  .regex(/[0-9]/, "Use a number");
export const registerSchema = z.object({
  returnTo: z.string().max(2048).optional(),
  email: z
    .string()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  password,
  displayName: z.string().trim().min(2).max(100),
});
export const loginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  returnTo: z.string().max(2048).optional(),
});
export const resetPasswordSchema = z.object({ token: z.string().min(20), password });
