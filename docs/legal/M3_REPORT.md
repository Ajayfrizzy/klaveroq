# M3 implementation report

Branch: `feature/m3-legal-policies`. Base: updated staging `c71548b`.
The commit SHA is supplied in the completion message and can be obtained with `git rev-parse HEAD` on this branch. The implementation is for local manual review; it is not legal approval or deployment.

## Delivered

- Public `/legal` hub and `/legal/terms`, `/legal/privacy`, `/legal/account-deletion`, `/legal/community-guidelines`, `/legal/cookies`, `/legal/payments`.
- Six individually maintained structured-text documents, shared version/status/date registry, server-rendered layout, section navigation/anchors and page-specific canonical/social metadata. Drafts remain noindex and require no authentication or account lookup.
- Public footer links all six policies. Registration, account settings/deletion/recovery, privacy requests and support expose relevant draft links. No checkbox, implied acceptance, consent backfill, marketing opt-in or new authentication requirement.
- Corrected deletion-screen text that promised removal after 30 days despite disabled cleanup. It now distinguishes eligibility for processing from actual beta cleanup operation.
- Preserved server-owned legal titles rather than allowing the legacy client route-title helper to overwrite them.
- [Product/processor/cookie/consent audit](PRODUCT_POLICY_AUDIT.md), [policy register and architecture](POLICY_REGISTER.md), [legal review and activation checklist](LEGAL_REVIEW_CHECKLIST.md), screenshots and stable project instructions.

## Product and policy findings

The operator brief identifies RumptyCloud hosting and Supabase PostgreSQL. Resend is the implemented hosted email adapter; Google is an optional implemented sign-in integration. Neither configuration support nor a repository sample proves live enablement, contract terms, regions or provider retention. The requested provider/contact confirmation was not available when drafting; public pages use the existing working support/privacy routes and leave approval details outstanding. No invented company identity, business address, DPO, licence, forum, certification or fixed statutory retention duration appears in the policies.

Code estimates reflect proposed client fees of 3% and worker fees of 2%, but formal approval was not established. The payment notice clearly says that real payments, escrow funding, refunds and settlement are not operational. It presents fees only as non-binding proposals and distinguishes PactAgent from live Klaveroq services.

The cookie inventory covers the configurable essential account cookie, four 10-minute Google OAuth cookies, verification continuation session storage, import-dismissal storage and legacy preferences. No optional application analytics/tracking integration was identified; hosting-level and provider behaviour still needs a live audit.

M2 guards, explicit recovery, deadlines, records and holds remain unchanged. Final account cleanup remains disabled by default. The public notice explains that 30 days is a recovery product policy, not a statutory request deadline or guaranteed erasure date.

## Versioning and acceptance decision

All documents are `0.1-draft`, updated 31 October 2026, explicitly not yet effective. Existing agreement `termsAcceptedAt` and fee-calculation `policyVersion` fields do not track acceptance of service policies. Draft metadata/content infrastructure is prepared, and the checklist defines requirements for a future exact-version/timestamp consent ledger and notice/rollout plan. No migration or acceptance persistence is justified or activated for unapproved drafts. Existing beta users are not blocked or retrospectively enrolled.

## Validation

Validation uses synthetic data only in the local disposable PostgreSQL database. Browser tests run in the same Playwright v1.63.0 Noble Linux image as CI; production builds run in test-server setup. No hosted migrations or data operations occur.

Commands: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, plus explicit Prettier checks for ignored documentation and `git diff --check`. Linux browser pipeline: `node scripts/reset-test-db.mjs`, `node scripts/run-playwright.mjs`, `node scripts/run-playwright.mjs --config=playwright.beta.config.ts`, and `node scripts/run-playwright.mjs --config=playwright.lifecycle.config.ts`. Each browser server runs `npm run build` before startup. The focused legal run used `tests/e2e/legal.spec.ts --project=chromium --no-deps`; support references were regenerated with `--update-snapshots=changed` and subsequently compared without updating.

- TypeScript: passed.
- ESLint: passed.
- Formatting: passed, including explicit checks of the legal documentation.
- Unit tests: 278 passed across 50 files.
- New legal browser tests: 4 passed. All seven routes, status/version/date, metadata/canonical/noindex, keyboard hub/section navigation, unknown-policy boundary, 375px/390px/1280px reflow and axe WCAG A/AA checks; contextual links and actual registration continuation without new consent.
- Visual refresh: 2 passed. Only the support-375/support-1440 baselines changed for new links; comparison thresholds retained.
- Full browser/authentication/beta/M2 regressions: **94 passed** (68 main, 11 beta, 15 lifecycle). The complete sequential pipeline exited successfully.
- Production builds: passed in each Playwright server setup. Disposable-database migrations: passed as part of the reset/setup.
- Existing rapid-navigation stream-close logs and the deliberate lifecycle cleanup-failure injection appeared; all test assertions passed.

The first test expected HTTP 404 for unknown policy slugs. Installed Next.js documentation confirms that streamed `notFound()` responses can use HTTP 200. The final test asserts the real not-found boundary, no policy article and noindex. This framework behaviour is not bypassed with broad middleware changes.

## Screenshots

All screenshots use public draft content. Visual review supplements automated accessibility checks. The anchor highlight visible in document captures demonstrates keyboard focus.

| Viewport       | Legal hub                       | Account deletion                                  | Payments                                  |
| -------------- | ------------------------------- | ------------------------------------------------- | ----------------------------------------- |
| Desktop 1280px | [Hub](screenshots/hub-1280.png) | [Deletion](screenshots/account-deletion-1280.png) | [Payments](screenshots/payments-1280.png) |
| Mobile 375px   | [Hub](screenshots/hub-375.png)  | [Deletion](screenshots/account-deletion-375.png)  | [Payments](screenshots/payments-375.png)  |
| Mobile 390px   | [Hub](screenshots/hub-390.png)  | [Deletion](screenshots/account-deletion-390.png)  | [Payments](screenshots/payments-390.png)  |

## Remaining decisions and limitations

- All text requires operator and qualified legal review before formal publication/acceptance. No verified operator identity/address, public contact email, appointed reviewer, effective date or governing forum has been supplied.
- Confirm the active email/OAuth providers, infrastructure regions/contracts/subprocessors, hosting-added cookies, backups/logs, international transfers and appropriate legal bases using separately authorised access. The source audit is not a production compliance attestation.
- Approve eligibility/minors, content licence/ownership, moderation/appeals, liability, privacy-response staffing/deadlines, exceptions and retention categories. The existing privacy queue is intake plus a privileged latest-50 API; no new case-management dashboard or automatic data export is supplied.
- Payment fees/provider roles/regulatory review/refunds are unresolved. Live payment, KYC, uploads and cleanup must trigger new policy review and separate technical/operational activation.
- No live Google or email-provider test, physical-device test or legal approval was performed. Browser mobile widths and existing simulated auth/email flows were exercised.
- Version metadata and git history are not a consent ledger. No mandatory acceptance is enabled. Final approved versions, history, notice and any required additive persistence/API migration must be reviewed separately.
- No PactAgent modifications, financial settlement changes, storage/scanner deployment, production secret changes, hosted database resets, pushes, merges or deployments are included.

## Files changed

- `apps/web/AGENTS.md`
- `apps/web/src/app/account/privacy/page.tsx`
- `apps/web/src/app/legal/[slug]/page.tsx`
- `apps/web/src/app/legal/layout.tsx`
- `apps/web/src/app/legal/page.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/components/layout/route-title.tsx`
- `apps/web/src/features/account/lifecycle-form.tsx`
- `apps/web/src/features/auth/components/auth-form.tsx`
- `apps/web/src/features/legal/documents/account-deletion.ts`
- `apps/web/src/features/legal/documents/community-guidelines.ts`
- `apps/web/src/features/legal/documents/cookies.ts`
- `apps/web/src/features/legal/documents/index.ts`
- `apps/web/src/features/legal/documents/payments.ts`
- `apps/web/src/features/legal/documents/privacy.ts`
- `apps/web/src/features/legal/documents/terms.ts`
- `apps/web/src/features/legal/metadata.ts`
- `apps/web/src/features/legal/policies.test.ts`
- `apps/web/src/features/legal/policy-links.tsx`
- `apps/web/src/features/legal/registry.ts`
- `apps/web/src/features/marketplace/components/public-footer.tsx`
- `apps/web/src/features/support/components/support-home.tsx`
- `apps/web/src/styles/legal.css`
- `apps/web/src/styles/product-experience.css`
- `apps/web/tests/e2e/beta-refinement.spec.ts-snapshots/support-1440-chromium-linux.png`
- `apps/web/tests/e2e/beta-refinement.spec.ts-snapshots/support-375-chromium-linux.png`
- `apps/web/tests/e2e/legal.spec.ts`
- `docs/legal/LEGAL_REVIEW_CHECKLIST.md`
- `docs/legal/M3_REPORT.md`
- `docs/legal/POLICY_REGISTER.md`
- `docs/legal/PRODUCT_POLICY_AUDIT.md`
- `docs/legal/screenshots/account-deletion-1280.png`
- `docs/legal/screenshots/account-deletion-375.png`
- `docs/legal/screenshots/account-deletion-390.png`
- `docs/legal/screenshots/hub-1280.png`
- `docs/legal/screenshots/hub-375.png`
- `docs/legal/screenshots/hub-390.png`
- `docs/legal/screenshots/payments-1280.png`
- `docs/legal/screenshots/payments-375.png`
- `docs/legal/screenshots/payments-390.png`
