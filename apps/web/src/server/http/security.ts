import { createHash, randomBytes } from "node:crypto";
import { ApiError } from "./errors";

export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export function assertSameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_URL ?? "http://127.0.0.1:3000").origin;
  if (!origin || origin !== expected)
    throw new ApiError(403, "INVALID_ORIGIN", "The request origin is not allowed.");
}

export const clientIpHash = (request: Request) => {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local";
  return sha256(`${ip}:${process.env.SESSION_SECRET ?? "local-development"}`);
};
