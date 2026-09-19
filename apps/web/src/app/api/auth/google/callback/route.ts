import { createRemoteJWKSet, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { GOOGLE_OAUTH_COOKIES } from "@/server/auth/google";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { authIdentities, profiles, users } from "@/server/db/schema";
import { createSession } from "@/server/auth/session";
import { ApiError, withApi } from "@/server/http/errors";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
export const GET = withApi(async (request: Request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const expectedState = store.get(GOOGLE_OAUTH_COOKIES.state)?.value;
  const nonce = store.get(GOOGLE_OAUTH_COOKIES.nonce)?.value;
  const verifier = store.get(GOOGLE_OAUTH_COOKIES.verifier)?.value;
  store.delete(GOOGLE_OAUTH_COOKIES.state);
  store.delete(GOOGLE_OAUTH_COOKIES.nonce);
  store.delete(GOOGLE_OAUTH_COOKIES.verifier);
  if (!code || !state || state !== expectedState || !nonce || !verifier)
    throw new ApiError(400, "OAUTH_STATE_INVALID", "Google sign-in could not be verified.");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new ApiError(503, "GOOGLE_OAUTH_NOT_CONFIGURED", "Google sign-in is not configured.");
  const callback = `${process.env.APP_URL ?? "http://127.0.0.1:3000"}/api/auth/google/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callback,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!tokenResponse.ok)
    throw new ApiError(
      502,
      "GOOGLE_TOKEN_EXCHANGE_FAILED",
      "Google sign-in could not be completed.",
    );
  const token = (await tokenResponse.json()) as { id_token?: string };
  if (!token.id_token)
    throw new ApiError(502, "GOOGLE_ID_TOKEN_MISSING", "Google did not return an identity token.");
  const { payload } = await jwtVerify(token.id_token, googleKeys, {
    audience: clientId,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });
  if (payload.nonce !== nonce || !payload.sub || !payload.email || payload.email_verified !== true)
    throw new ApiError(
      400,
      "GOOGLE_IDENTITY_INVALID",
      "The Google identity is incomplete or unverified.",
    );
  const email = String(payload.email).toLowerCase();
  const userId = await db.transaction(async (tx) => {
    const [identity] = await tx
      .select()
      .from(authIdentities)
      .where(
        sql`${authIdentities.provider} = 'google' AND ${authIdentities.providerSubject} = ${payload.sub}`,
      )
      .limit(1);
    if (identity) return identity.userId;
    let [user] = await tx
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (!user) {
      [user] = await tx
        .insert(users)
        .values({ email, emailVerifiedAt: new Date(), status: "ACTIVE" })
        .returning();
      await tx
        .insert(profiles)
        .values({ userId: user.id, displayName: String(payload.name ?? email.split("@")[0]) });
    }
    await tx.insert(authIdentities).values({
      userId: user.id,
      provider: "google",
      providerSubject: String(payload.sub),
      providerEmail: email,
    });
    return user.id;
  });
  await createSession(userId, request);
  return Response.redirect(new URL("/", process.env.APP_URL ?? "http://127.0.0.1:3000"));
});
