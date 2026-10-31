import type { PolicySection } from "../registry";
export const cookies: PolicySection[] = [
  {
    id: "scope",
    title: "1. What this notice covers",
    paragraphs: [
      "This draft covers cookies and browser storage identified in Klaveroq’s application. Cookies are small values sent with requests to a site; browser session storage and local storage are different mechanisms described separately below. Hosting-level additions and external provider behaviour must be checked on the live deployment before final approval.",
    ],
  },
  {
    id: "session",
    title: "2. Essential account-session cookie",
    paragraphs: [
      "The application uses a first-party session cookie, named klaveroq_session by default, to recognise a signed-in account. Its name and duration can be configured by the operator. The code’s default expiry is 30 days from session creation; it does not establish that every hosted session uses that exact setting. The cookie applies to the site path /.",
      "The session cookie is HttpOnly, uses SameSite=Lax and is marked Secure in production. It contains a session token; the server stores a hash for lookup. Signing out deletes the current cookie and revokes that session. Revoking other sessions or requesting account closure prevents their further authenticated use even if a browser still holds an old cookie.",
    ],
  },
  {
    id: "google",
    title: "3. Short-lived Google sign-in cookies",
    paragraphs: [
      "Starting Google sign-in sets klaveroq_google_state, klaveroq_google_nonce, klaveroq_google_verifier and klaveroq_google_return_to. They bind the sign-in response to the request, support nonce and PKCE checks, and remember a safe in-app destination. They are scoped to /api/auth/google, have a maximum age of 600 seconds (10 minutes), and are cleared during callback handling.",
      "These cookies are HttpOnly, SameSite=Lax and Secure in production. Google may use its own cookies on its service during sign-in; this application audit does not establish Google’s full cookie inventory or retention. You can choose password sign-in instead where your account has a password.",
    ],
  },
  {
    id: "storage",
    title: "4. Browser storage and preferences",
    paragraphs: [
      "The session-storage entry klaveroq:auth-return remembers the safe destination after registration and email verification in that browser tab. Session storage also records a dismissed legacy-preference import prompt under klaveroq:import-declined:<userId>. These entries last for the browser page session, subject to browser restore behaviour or manual clearing; they are not authentication cookies.",
      "Older device preferences may remain in local storage under klaveroq:intent:<userId>, klaveroq:searches:<userId>:/discover, klaveroq:searches:<userId>:/talent and klaveroq:shortlist:<userId>. Local storage has no application-set expiry. The current interface offers an explicit import into account preferences and removes successfully imported values when safe. Declining import preserves the device data. Current saved account preferences are held on the server, not stored as tracking cookies.",
    ],
  },
  {
    id: "tracking",
    title: "5. Analytics and optional tracking",
    paragraphs: [
      "No advertising or analytics cookie integration was identified in the application audit. This is not a claim about every hosting-layer service, browser extension or external provider. There is no optional cookie-consent control enabled by this milestone because no such application tracking has been verified.",
      "Any future analytics, marketing or other non-essential tracking must be inventoried and legally assessed before activation, with an appropriate choice mechanism where required. Accepting service terms must not be treated as consent to optional tracking.",
    ],
  },
  {
    id: "choices",
    title: "6. Your controls",
    paragraphs: [
      "Use sign-out and session-management controls for account access. Your browser can block cookies or clear cookies and site storage; blocking essential cookies can prevent sign-in, and clearing storage can remove remembered destinations or device preferences. Clearing a browser does not delete server-side account records.",
      "Use account settings or the public privacy route for account closure or questions about data use. This draft’s durations describe application settings, not a universal legal retention period or a promise about provider logs.",
    ],
    links: [
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Privacy and account support", href: "/account/privacy" },
    ],
  },
];
