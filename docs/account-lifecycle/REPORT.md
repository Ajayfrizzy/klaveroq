# M2 implementation report

Branch: `feature/m2-account-lifecycle`. Base: updated staging `6c824c1`.
Implementation is committed locally for manual review. No push, merge, deployment,
hosted migration or automatic production cleanup was performed.

## Observed profile/login failure

Before implementation, a synthetic account was registered in the isolated loopback
PostgreSQL database. Removing only its profile left password login returning HTTP 200,
but visiting `/profile` redirected back to `/login?returnTo=/profile`. The profile page
incorrectly treated a missing presentation row as an unauthenticated user. This is the
reproduced root cause of the apparent login failure, not a destroyed password credential.
Deleting the user itself was rejected with PostgreSQL 23503. The audit FK is NO ACTION;
it is deliberately preserved.

The profile page now distinguishes a missing user session from a missing profile and
routes the latter to an explicit private-profile repair action. The regression test
checks that sign-in works, repair creates only a private profile, and user hard deletion
still fails under retained foreign keys.

## Architecture and retention

[Design and entity matrix](DESIGN.md) was written before cleanup implementation.
[Operations](OPERATIONS.md) documents transitions, API contracts, security controls,
migration handling, rollback cautions and the separate activation checklist.

Existing account states remain; PENDING_DELETION, CLOSED_RETAINED and ANONYMIZED are
additive. A closure request stores its timestamp, database-clock 30-day deadline, prior
visibility, final/recovery timestamps, retention reasons and review date. Ordinary login
never cancels deletion. Fresh password or passwordless-email confirmation plus enabled
MFA is required for explicit deletion/recovery. No session is created on recovery; the
user signs in again. The exact deadline is exclusive.

User UUIDs and audit/financial/shared history survive. Eligible owner-private identity
and credentials are minimized after the deadline; unknown, legally sensitive and
counterparty records are retained for review. There is no universal financial/audit
purge duration. The original short-lived retention worker now honors holds. A new
account/legal hold is distinct from the existing temporary wallet-change hold.

Mutating handlers coordinate with a database advisory gate. Lifecycle transitions and
cleanup take its exclusive side and use row locks/transactions for the state, audit and
outbox. Counterparty mutations cannot race the eligibility check. The separate bounded
coordination pool prevents lock waiters consuming application transaction connections.
Cleanup processes at most ten accounts, rechecks all blockers, records deferred review
and failure state, and supports retries after partial batch failure.

## Migration

`apps/web/drizzle/20261031151510_account_lifecycle.sql` was generated with Drizzle's
`--prefix timestamp --name account_lifecycle`. It adds three enum values and the
account_closures, account_holds and account_privacy_requests tables and their indexes/FKs.
No existing row or FK is removed. Applied successfully to both a populated disposable
database and a freshly initialized disposable database. Uniqueness and audit FK behavior
are covered by integration tests.

Vellum PR #5 was inspected read-only: it introduces a separate 0018. Timestamped SQL and
snapshot names prevent filename collisions; the divergent journal history still requires
Drizzle regeneration of whichever feature integrates second against combined history.
The Vellum PR was not changed. Do not deploy by blindly merging its journal with this one.
A pre-M2 app rollback is unsafe while new lifecycle states exist; disable cleanup and
forward-fix with guards intact. Full recovery instructions are in OPERATIONS.md.

## Validation executed

All database writes used synthetic data on `127.0.0.1:55434/klaveroq_test`.

| Command/check                                                                                                                                                                                                         | Result                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `npm run typecheck`                                                                                                                                                                                                   | Passed                                      |
| `npm run lint`                                                                                                                                                                                                        | Passed, no warnings in final run            |
| `npm run format:check`                                                                                                                                                                                                | Passed after restoring generated Next files |
| `npm test`                                                                                                                                                                                                            | 276 passed across 49 files                  |
| `node scripts/run-playwright.mjs --config=playwright.lifecycle.config.ts`                                                                                                                                             | 15 passed                                   |
| `node scripts/run-playwright.mjs tests/e2e/auth.spec.ts tests/e2e/auth-ux.spec.ts tests/e2e/client-invites.spec.ts tests/e2e/marketplace.integration.spec.ts tests/e2e/security.spec.ts --project=chromium --no-deps` | 14 passed                                   |
| Production `npm run build` in Playwright server setup                                                                                                                                                                 | Passed                                      |
| Populated and fresh migration application                                                                                                                                                                             | Passed; no hosted database accessed         |
| Axe checks and keyboard confirmation at desktop/375px/390px                                                                                                                                                           | Passed; no horizontal overflow              |

Lifecycle scenarios cover request confirmation/reauthentication/origin/size checks,
idempotent concurrent requests, MFA and one-use recovery codes, passwordless email token
expiry/purpose/replay, pending login and API/invitation restrictions, recovery before/after
the deadline, session revocation, no-activity anonymization, historical agreement/payment
integrity, active agreements/disputes/operations, holds/suspension, audit retention, public
profile hiding, simultaneous cleanup, disabled/unauthorized cron execution, injected
transaction failure with rollback/retry and migration uniqueness. Google OAuth state
restrictions are unit-tested; live Google authorization is not automated here. Existing
auth/password reset/email verification and security workflows passed regression tests.

The expected cleanup-failure log is emitted by the deliberate failure-injection test.
Some browser navigations produced the existing Next “destination stream closed early”
log; assertions and suites passed. No screenshots from unrelated suites are included.

## Screenshots

Synthetic accounts only. Visual inspection supplemented automated accessibility checks.

| Width          | Delete confirmation                   | Pending confirmation                    | Explicit recovery                       |
| -------------- | ------------------------------------- | --------------------------------------- | --------------------------------------- |
| Desktop 1280px | [Delete](screenshots/delete-1280.png) | [Pending](screenshots/pending-1280.png) | [Recover](screenshots/recover-1280.png) |
| Mobile 375px   | [Delete](screenshots/delete-375.png)  | [Pending](screenshots/pending-375.png)  | [Recover](screenshots/recover-375.png)  |
| Mobile 390px   | [Delete](screenshots/delete-390.png)  | [Pending](screenshots/pending-390.png)  | [Recover](screenshots/recover-390.png)  |

## Remaining limitations and activation decisions

- Cleanup is disabled by default; no production scheduler or hosted settings were changed.
- Jurisdiction-specific retention, legal bases, external provider handling, and exception
  decisions require authorized legal/operational review. Shared text can still identify a
  person; ANONYMIZED refers to the direct account identity, not universal anonymization.
- Uploaded objects and sensitive evidence are preserved privately for separate review.
  Uploads, live KYC and real financial flows remain disabled/unmodified.
- Local records are the beta obligation source. Before real financial use, reconcile
  external PactAgent obligations; do not activate cleanup if that cannot be established.
- The privileged review queue is an API with a latest-50 window, not a complete new admin
  dashboard. Operators must monitor/review the backlog and verify ownership for exceptions.
- Live email-provider delivery, real Google OAuth and physical devices were not exercised.
  Email actions use the existing durable outbox and simulated delivery in integration tests.
- The conservative shared/exclusive gate trades write throughput for correctness and needs
  database connection budgeting. Future external workers must participate in coordination.
- M3 legal-policy content was not started; existing screens link to the working privacy
  request route and wait for approved policy pages before adding legal-policy links.

## Files changed

- `apps/web/AGENTS.md`
- `apps/web/drizzle/20261031151510_account_lifecycle.sql`
- `apps/web/drizzle/meta/20261031151510_snapshot.json`
- `apps/web/drizzle/meta/_journal.json`
- `apps/web/package.json`
- `apps/web/playwright.config.ts`
- `apps/web/playwright.lifecycle.config.ts`
- `apps/web/src/app/account/privacy/page.tsx`
- `apps/web/src/app/account/recover/page.tsx`
- `apps/web/src/app/account/settings/page.tsx`
- `apps/web/src/app/api/account/closure/route.ts`
- `apps/web/src/app/api/account/confirmation/route.ts`
- `apps/web/src/app/api/account/privacy/route.ts`
- `apps/web/src/app/api/account/recover/route.ts`
- `apps/web/src/app/api/account/repair-profile/route.ts`
- `apps/web/src/app/api/admin/account-holds/route.ts`
- `apps/web/src/app/api/admin/account-requests/route.ts`
- `apps/web/src/app/api/auth/google/callback/route.ts`
- `apps/web/src/app/api/auth/login/route.ts`
- `apps/web/src/app/api/auth/mfa/challenge/route.ts`
- `apps/web/src/app/api/auth/password/request/route.ts`
- `apps/web/src/app/api/auth/password/reset/route.ts`
- `apps/web/src/app/api/auth/verify-email/resend/route.test.ts`
- `apps/web/src/app/api/auth/verify-email/resend/route.ts`
- `apps/web/src/app/api/auth/verify-email/route.ts`
- `apps/web/src/app/api/internal/accounts/cleanup/route.test.ts`
- `apps/web/src/app/api/internal/accounts/cleanup/route.ts`
- `apps/web/src/app/api/internal/files/cleanup/route.test.ts`
- `apps/web/src/app/api/media/avatar/[userId]/route.ts`
- `apps/web/src/app/api/media/portfolio/[id]/route.ts`
- `apps/web/src/app/profile/page.tsx`
- `apps/web/src/app/wallet/page.tsx`
- `apps/web/src/features/account/lifecycle-form.tsx`
- `apps/web/src/features/account/privacy-form.tsx`
- `apps/web/src/features/auth/components/auth-form.tsx`
- `apps/web/src/features/marketplace/server/queries.ts`
- `apps/web/src/features/talent/server/queries.ts`
- `apps/web/src/server/account/cleanup.ts`
- `apps/web/src/server/account/gate.ts`
- `apps/web/src/server/account/http.ts`
- `apps/web/src/server/account/public.ts`
- `apps/web/src/server/account/service.ts`
- `apps/web/src/server/account/state.test.ts`
- `apps/web/src/server/account/state.ts`
- `apps/web/src/server/audit-coverage.test.ts`
- `apps/web/src/server/auth/google.ts`
- `apps/web/src/server/auth/session-reliability.test.ts`
- `apps/web/src/server/auth/session.ts`
- `apps/web/src/server/db/schema/index.ts`
- `apps/web/src/server/files/upload-lifecycle.test.ts`
- `apps/web/src/server/files/uploads-disabled.test.ts`
- `apps/web/src/server/http/errors.test.ts`
- `apps/web/src/server/http/errors.ts`
- `apps/web/src/server/notifications/service.ts`
- `apps/web/src/server/retention/policy.test.ts`
- `apps/web/src/server/retention/policy.ts`
- `apps/web/src/styles/product-experience.css`
- `apps/web/tests/e2e/account-lifecycle.spec.ts`
- `docs/DATA_RETENTION.md`
- `docs/account-lifecycle/DESIGN.md`
- `docs/account-lifecycle/OPERATIONS.md`
- `docs/account-lifecycle/REPORT.md`
- Nine synthetic screenshots under `docs/account-lifecycle/screenshots/`.
