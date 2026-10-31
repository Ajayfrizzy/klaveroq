# Policy register

All documents: version **0.1-draft**, last updated **31 October 2026**, status **Draft — not yet effective**. Effective date: **not established**. Approval owner: **Klaveroq operator (individual/legal entity to confirm)**. Reviewer: **qualified legal/privacy reviewer to be appointed**. No document is approved or enforced as an acceptance requirement.

| Document                    | Route                         | Outstanding decisions                                                                                                                                       | Revision triggers                                                           |
| --------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Terms of Service            | `/legal/terms`                | Operator identity/address, age/capacity requirements, content licence, work ownership, liability, applicable law/forum, complaint and assent process        | Product scope, countries, agreement workflows, approved terms rollout       |
| Privacy Policy              | `/legal/privacy`              | Controller identity/contact, purpose-to-basis assessment, provider contracts/regions, transfers, rights deadlines, minors, backup handling, incident duties | New processors/countries, KYC, uploads, retention, analytics, payments      |
| Account Deletion & Recovery | `/legal/account-deletion`     | Classified retention, exception handling, reviewers, externally retained records, cleanup activation                                                        | Retention changes, live financial obligations, automatic cleanup activation |
| Community Guidelines        | `/legal/community-guidelines` | Moderation ownership, consistent notice/review/escalation, appeal process                                                                                   | New services/countries, fraud risks, enforcement changes                    |
| Cookies & Browser Storage   | `/legal/cookies`              | Verify hosted cookie name/TTL, hosting/provider cookies, optional tracking classification                                                                   | Authentication/storage changes, new tracking/providers/countries            |
| Payments, Escrow & Refunds  | `/legal/payments`             | Formal 3%/2% fee approval, fund flows, provider roles/licensing, countries/assets, taxes, identity checks, refunds/disputes                                 | Live payments, KYC, fees, arbitration, settlement or provider changes       |

The `/legal` hub displays all six routes and current status. Public navigation labels contextual links as drafts. No effective date is guessed from the last-update date.

## Architecture and change control

- `apps/web/src/features/legal/registry.ts`: shared public titles, slugs, descriptions, current version/status/date. Contains no private audit notes or secrets.
- `documents/*.ts`: one structured plain-text section list per policy. `documents/index.ts` maps only known slugs. No raw HTML, Markdown execution, remote content or arbitrary file lookup.
- `app/legal/[slug]/page.tsx`: allowlisted server rendering, accessible section anchors/TOC and shared document layout. Unknown slugs render the noindex not-found boundary (Next.js streamed responses may carry HTTP 200). Metadata includes title, description, canonical URL, social metadata and noindex while draft.
- `app/legal/layout.tsx`: public shell independent of account/database reads; no redirect or user-specific data. Root metadataBase uses the existing app origin. Public drafts retain site-wide noindex.
- `policy-links.tsx`: lightweight registry-only contextual links; legal body text stays server-rendered.
- Shared public footer links all policies; account/settings, recovery/deletion, privacy requests, registration and support expose relevant drafts.

For each future change, update the affected text and review matrix, bump its version/date (split registry entries into individual versions when their releases diverge), preserve prior approved versions immutably, and test page metadata/content/links. Git history preserves draft changes but is **not** a user-consent ledger. Do not simply flip a status string to activate binding terms.

Before versioned acceptance: approve exact documents and effective dates, define notice/reacceptance and rollback, add a reviewed version-specific persistence/API design, test additive migration against combined staging history, and separately authorise rollout. Existing users must not be silently backfilled. No acceptance mechanism, consent tracking, cookie banner, scheduled cleanup or database schema change is activated by M3.
