import { z } from "zod";
import { assertSameOrigin } from "../http/security";
import { enforceAuthRateLimit } from "../auth/rate-limit";
export const credentialsSchema = z.object({
  email: z
    .string()
    .email()
    .max(320)
    .transform((v) => v.toLowerCase()),
  password: z.string().max(128).optional(),
  token: z.string().min(20).max(128).optional(),
  code: z.string().max(40).optional(),
});
export async function accountRateLimit(request: Request, email: string, action: string) {
  assertSameOrigin(request);
  await enforceAuthRateLimit({ request, action, limit: 15, windowMs: 15 * 60_000 });
  // Account-wide in addition to IP quota, including anonymous recovery.
  await enforceAuthRateLimit({
    request: new Request(request.url),
    action: `${action}_account`,
    subject: email,
    limit: 8,
    windowMs: 15 * 60_000,
  });
}
