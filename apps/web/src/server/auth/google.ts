export const GOOGLE_OAUTH_COOKIES = {
  state: "klaveroq_google_state",
  nonce: "klaveroq_google_nonce",
  verifier: "klaveroq_google_verifier",
  returnTo: "klaveroq_google_return_to",
} as const;

export const GOOGLE_OAUTH_COOKIE_PATH = "/api/auth/google";
export const GOOGLE_OAUTH_COOKIE_MAX_AGE_SECONDS = 600;

export function safeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const parsed = new URL(value, "https://klaveroq.invalid");
    return parsed.origin === "https://klaveroq.invalid"
      ? `${parsed.pathname}${parsed.search}`
      : "/";
  } catch {
    return "/";
  }
}

export function googleOAuthHref(value: string | null | undefined) {
  return `/api/auth/google?returnTo=${encodeURIComponent(safeReturnTo(value))}`;
}

export function validOAuthTransaction(input: {
  code: string | null;
  state: string | null;
  expectedState: string | undefined;
  nonce: string | undefined;
  verifier: string | undefined;
}) {
  return Boolean(
    input.code &&
    input.state &&
    input.state === input.expectedState &&
    input.nonce &&
    input.verifier,
  );
}

export function googleAccountAction(input: {
  linked: boolean;
  linkedStatus?: string;
  emailOwnerExists: boolean;
}) {
  if (input.linked && ["SUSPENDED", "CLOSED"].includes(input.linkedStatus ?? ""))
    return "unavailable" as const;
  if (input.linked) return "login" as const;
  if (input.emailOwnerExists) return "conflict" as const;
  return "create" as const;
}

export function googleIdentityFromClaims(claims: Record<string, unknown>, expectedNonce: string) {
  if (
    claims.nonce !== expectedNonce ||
    typeof claims.sub !== "string" ||
    !claims.sub ||
    typeof claims.email !== "string" ||
    !claims.email ||
    claims.email_verified !== true
  )
    return null;
  return {
    subject: claims.sub,
    email: claims.email.toLowerCase(),
    displayName:
      typeof claims.name === "string" && claims.name.trim()
        ? claims.name.trim().slice(0, 100)
        : claims.email.split("@")[0].slice(0, 100),
  };
}

export const GOOGLE_OAUTH_MESSAGES: Record<string, string> = {
  access_denied: "Google sign-in was cancelled. You can try again or continue with email.",
  OAUTH_STATE_INVALID: "Google sign-in expired or could not be verified. Please try again.",
  GOOGLE_OAUTH_NOT_CONFIGURED: "Google sign-in is not configured yet. Continue with email instead.",
  GOOGLE_TOKEN_EXCHANGE_FAILED: "Google could not complete sign-in. Please try again.",
  GOOGLE_ID_TOKEN_MISSING: "Google did not return the information needed to sign you in.",
  GOOGLE_IDENTITY_INVALID: "Google returned an incomplete or unverified identity.",
  GOOGLE_ACCOUNT_CONFLICT:
    "An account already uses this email. Sign in with your existing method before connecting Google.",
  ACCOUNT_UNAVAILABLE: "This account cannot sign in. Contact support if you need help.",
  OAUTH_FAILED: "Google sign-in could not be completed. Please try again.",
};
