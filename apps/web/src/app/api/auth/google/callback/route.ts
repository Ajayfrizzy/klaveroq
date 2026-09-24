import { createRemoteJWKSet, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import {
  GOOGLE_OAUTH_COOKIES,
  GOOGLE_OAUTH_COOKIE_PATH,
  googleAccountAction,
  googleIdentityFromClaims,
  safeReturnTo,
  validOAuthTransaction,
} from "@/server/auth/google";
import { db } from "@/server/db";
import { authIdentities, profiles, users } from "@/server/db/schema";
import { createSession } from "@/server/auth/session";
import { ApiError } from "@/server/http/errors";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const appUrl = () => process.env.APP_URL ?? "http://127.0.0.1:3000";

function errorRedirect(code: string, returnTo = "/") {
  const url = new URL("/login", appUrl());
  url.searchParams.set("oauthError", code);
  if (returnTo !== "/") url.searchParams.set("returnTo", returnTo);
  return Response.redirect(url);
}

async function callback(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();
  const expectedState = store.get(GOOGLE_OAUTH_COOKIES.state)?.value;
  const nonce = store.get(GOOGLE_OAUTH_COOKIES.nonce)?.value;
  const verifier = store.get(GOOGLE_OAUTH_COOKIES.verifier)?.value;
  const returnTo = safeReturnTo(store.get(GOOGLE_OAUTH_COOKIES.returnTo)?.value);
  for (const name of Object.values(GOOGLE_OAUTH_COOKIES))
    store.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: GOOGLE_OAUTH_COOKIE_PATH,
      maxAge: 0,
    });

  const providerError = url.searchParams.get("error");
  if (providerError)
    return errorRedirect(
      providerError === "access_denied" ? providerError : "OAUTH_FAILED",
      returnTo,
    );

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (
    !validOAuthTransaction({ code, state, expectedState, nonce, verifier }) ||
    !code ||
    !nonce ||
    !verifier
  )
    throw new ApiError(400, "OAUTH_STATE_INVALID", "Google sign-in could not be verified.");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new ApiError(503, "GOOGLE_OAUTH_NOT_CONFIGURED", "Google sign-in is not configured.");

  const redirectUri = `${appUrl()}/api/auth/google/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
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
  const googleIdentity = googleIdentityFromClaims(payload, nonce);
  if (!googleIdentity)
    throw new ApiError(
      400,
      "GOOGLE_IDENTITY_INVALID",
      "The Google identity is incomplete or unverified.",
    );

  const { subject, email, displayName } = googleIdentity;
  const userId = await db.transaction(async (tx) => {
    const [identity] = await tx
      .select({ userId: authIdentities.userId })
      .from(authIdentities)
      .where(
        and(eq(authIdentities.provider, "google"), eq(authIdentities.providerSubject, subject)),
      )
      .limit(1);
    if (identity) {
      const [linkedUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, identity.userId))
        .limit(1);
      if (
        !linkedUser ||
        googleAccountAction({
          linked: true,
          linkedStatus: linkedUser.status,
          emailOwnerExists: true,
        }) === "unavailable"
      )
        throw new ApiError(403, "ACCOUNT_UNAVAILABLE", "This account cannot sign in.");
      await tx
        .update(users)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, linkedUser.id));
      return linkedUser.id;
    }

    const [emailOwner] = await tx
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (
      googleAccountAction({ linked: false, emailOwnerExists: Boolean(emailOwner) }) === "conflict"
    )
      throw new ApiError(
        409,
        "GOOGLE_ACCOUNT_CONFLICT",
        "Sign in with your existing method before connecting Google.",
      );

    const [created] = await tx
      .insert(users)
      .values({ email, emailVerifiedAt: new Date(), status: "ACTIVE", lastLoginAt: new Date() })
      .onConflictDoNothing()
      .returning();
    if (!created) {
      const [concurrentIdentity] = await tx
        .select({ userId: authIdentities.userId, status: users.status })
        .from(authIdentities)
        .innerJoin(users, eq(users.id, authIdentities.userId))
        .where(
          and(eq(authIdentities.provider, "google"), eq(authIdentities.providerSubject, subject)),
        )
        .limit(1);
      if (
        concurrentIdentity &&
        googleAccountAction({
          linked: true,
          linkedStatus: concurrentIdentity.status,
          emailOwnerExists: true,
        }) === "login"
      )
        return concurrentIdentity.userId;
      if (concurrentIdentity)
        throw new ApiError(403, "ACCOUNT_UNAVAILABLE", "This account cannot sign in.");
      throw new ApiError(
        409,
        "GOOGLE_ACCOUNT_CONFLICT",
        "Sign in with your existing method before connecting Google.",
      );
    }
    await tx.insert(profiles).values({
      userId: created.id,
      displayName,
    });
    const inserted = await tx
      .insert(authIdentities)
      .values({
        userId: created.id,
        provider: "google",
        providerSubject: subject,
        providerEmail: email,
      })
      .onConflictDoNothing()
      .returning({ userId: authIdentities.userId });
    if (!inserted.length)
      throw new ApiError(409, "OAUTH_FAILED", "Google sign-in could not be completed safely.");
    return created.id;
  });

  await createSession(userId, request);
  return Response.redirect(new URL(returnTo, appUrl()));
}

export async function GET(request: Request) {
  let returnTo = "/";
  try {
    returnTo = safeReturnTo((await cookies()).get(GOOGLE_OAUTH_COOKIES.returnTo)?.value);
    return await callback(request);
  } catch (error) {
    if (error instanceof ApiError) return errorRedirect(error.code, returnTo);
    console.error(error);
    return errorRedirect("OAUTH_FAILED", returnTo);
  }
}
