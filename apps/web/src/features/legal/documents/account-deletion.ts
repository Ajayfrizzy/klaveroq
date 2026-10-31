import type { PolicySection } from "../registry";
export const accountDeletion: PolicySection[] = [
  {
    id: "request",
    title: "1. Requesting account closure",
    paragraphs: [
      "Open Account settings from Wallet & security and read the deletion explanation. Confirm with your current password, or use the email confirmation flow for an eligible Google account without a password. If two-factor authentication is enabled, its confirmation is also required. Type DELETE and submit the request. A profile is part of an account; removing profile information alone does not delete the account.",
      "Closure checks for active agreements, unsettled operations, disputes, security restrictions and legal holds. If a blocker is reported, resolve the obligation or contact support. Historical completed activity alone does not permanently prevent closure. Repeating an accepted request does not restart its recovery window.",
    ],
    links: [{ label: "Open account settings (sign-in required)", href: "/account/settings" }],
  },
  {
    id: "immediate",
    title: "2. What happens immediately",
    paragraphs: [
      "Once an eligible request is accepted, your profile is hidden from public discovery, active sessions are revoked and ordinary marketplace use is restricted. Open listings are closed, submitted proposals withdrawn and pending invitations you sent revoked. Existing shared agreements and necessary historical evidence remain intact.",
      "The confirmation screen gives the recovery deadline, and an email notice is queued with the request, date and recovery instructions. Email delivery is not guaranteed; keep the displayed deadline. If you did not request closure, use the secure recovery route promptly and raise an account-security concern.",
    ],
  },
  {
    id: "recovery",
    title: "3. The 30-day recovery period",
    paragraphs: [
      "The product recovery period lasts 30 days from the accepted request. Before the stated deadline, open Recover account, provide fresh credentials and two-factor confirmation where enabled, type RECOVER and explicitly cancel deletion. Logging in does not silently cancel a request. Restrictions or holds may require support review before recovery is possible.",
      "After recovery, sign in again. Eligible prior public-profile visibility can be restored, but closed listings, withdrawn proposals and revoked invitations are not reopened. Unverified accounts still need email verification. At or after the deadline, ordinary recovery is unavailable even if final cleanup has not run. Contact support for review; restoration is not guaranteed.",
    ],
    links: [{ label: "Recover account", href: "/account/recover" }],
  },
  {
    id: "after-window",
    title: "4. After the window: beta processing limitation",
    paragraphs: [
      "Automatic final account cleanup is not activated in the current community beta. Retention and compliance review must be completed before it is enabled. The 30-day date is the end of ordinary recovery and the earliest scheduled processing point, not a promise that all data will be erased on that day.",
      "When approved cleanup is operated, eligibility and holds are checked again. Eligible direct account information and credentials can be removed or replaced with a non-identifying account label. Accounts with historical records can remain closed with restricted records retained. Processing may be deferred where obligations, preservation needs or failures require review.",
    ],
  },
  {
    id: "retained",
    title: "5. What may remain and why",
    paragraphs: [
      "Necessary agreements, milestone and settlement evidence, counterparty communications, support cases, security and audit evidence, and legal-hold material may be retained for an assessed purpose. Closure must not destroy another participant’s records or break historical agreement references. Financial history does not automatically justify keeping every item forever; records require classification and review.",
      "Removing direct account identity is not the same as complete anonymisation. Shared text, external references, retained file metadata or evidence may still identify someone. Uploaded objects, provider copies and backups need separately authorised handling. These records are not made public merely because they are retained. No universal legally required duration has been approved for all retained data.",
    ],
  },
  {
    id: "exceptions",
    title: "6. Privacy requests, exceptions and help",
    paragraphs: [
      "The 30-day recovery period is a product policy, not a statutory deadline for responding to privacy requests. You can request earlier handling, correction, a retention review or an exception through the public privacy form even when you cannot sign in. Applicable rights, legal duties, identity verification and the rights of other people must be assessed for each request.",
      "Fraud investigations, security restrictions and legal holds can prevent ordinary deletion or recovery while relevant evidence is preserved. Ask for review with your request reference and a concise explanation; do not send passwords, recovery codes, identity documents or payment secrets.",
    ],
    links: [
      { label: "Submit a privacy or account-support request", href: "/account/privacy" },
      { label: "Privacy Policy", href: "/legal/privacy" },
    ],
  },
];
