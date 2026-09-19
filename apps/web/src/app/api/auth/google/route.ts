import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { withApi, ApiError } from "@/server/http/errors";
import { randomToken } from "@/server/http/security";
import { GOOGLE_OAUTH_COOKIES } from "@/server/auth/google";

export const GET = withApi(async () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId)
    throw new ApiError(503, "GOOGLE_OAUTH_NOT_CONFIGURED", "Google sign-in is not configured.");
  const state = randomToken(24);
  const nonce = randomToken(24);
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const store = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 600,
  };
  store.set(GOOGLE_OAUTH_COOKIES.state, state, options);
  store.set(GOOGLE_OAUTH_COOKIES.nonce, nonce, options);
  store.set(GOOGLE_OAUTH_COOKIES.verifier, verifier, options);
  const callback = `${process.env.APP_URL ?? "http://127.0.0.1:3000"}/api/auth/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callback,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return Response.redirect(url);
});
