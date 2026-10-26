# Client Invites

## Implementation plan

1. Add a feature-owned client invitation lifecycle using existing users, database transactions,
   rate-limit storage, audit logs, notification records, and email delivery infrastructure.
2. Store hashed, seven-day tokens; rotate on resend; authorize recipients by verified email;
   serialize accept/decline/resend/revoke and agreement creation with row locks.
3. Add workspace history, invitation landing/continuation, and persistent client agreement actions.
4. Extend the existing direct agreement wizard/API with an invitation association. Record freelancer
   terms acknowledgement separately from funded acceptance; preserve all payment boundaries.
5. Generate migrations, add lifecycle/security/browser coverage, capture screenshots, and document results.

## Architecture findings

There is no client-onboarding invitation entity. Existing `jobs` participants are client and worker;
marketplace awards and direct agreements converge on those records and milestones. Accounts can both
hire and work (workspace focus is a preference, not a role). Authentication already supports safe
`returnTo` through registration, email verification, MFA and OAuth. Notifications have a durable email
outbox and local/Resend providers. Funded job acceptance is a separate payment-dependent workflow.
The README references a missing `apps/web/src/README.md`; `apps/web/AGENTS.md` is the existing agent guide.
No repository Codex skill directory existed at inspection. Work is based on local `staging`.

## Implemented behavior

- `/client-invites` is the authenticated invitation form and owner history; the dashboard links to it.
- `/client-invites/respond?token=…` shows only a generic introduction until the invited verified
  account signs in. Existing auth continuation now also travels in verification emails, including
  resends, so opening verification on another device does not discard the destination.
- Tokens use 32 cryptographically random bytes and SHA-256 storage. They expire after seven days.
  Resend rotates the token; accepted, declined and revoked links cannot be consumed again.
- Creation and resend share a 20/hour account quota and a 50/hour IP quota. Self-invites and
  duplicate pending invitations to the same email from the same sender are rejected.
- Owner operations and responses lock invitation records. Agreement creation locks the accepted
  invitation and associates one existing-domain job with it, including when concurrent requests
  use different idempotency keys. The freelancer association is enforced server-side.
- Existing email preferences and local/Resend providers apply. Delivery failures remain in the
  existing retry outbox; links remain copyable. Personal project text is shown only after recipient
  authorization. In-flight mail may still arrive after revoke/resend, but its token is invalid.
- Audit records cover creation, resend, revoke, response, expiry, agreement creation, and terms
  acceptance. In-app notifications inform the freelancer of responses and the client of terms
  acceptance. Existing agreement notifications still inform the freelancer of new terms to review.
- The existing notification maintenance endpoint materializes expired records and scrubs queued
  tokens. Expiry is enforced immediately even when maintenance has not run.
- `jobs.termsAcceptedAt` records consent without changing job funding status or milestone state.
  Existing funded acceptance remains separate. No wallet, identity-provider check, payment,
  escrow, refund, settlement, proposal credit, or proposal fee is introduced by onboarding.

## Database migration

Generated `apps/web/drizzle/0017_smooth_bucky.sql` adds `client_invites` and the nullable
`jobs.terms_accepted_at` column. Foreign keys reference existing users and jobs. Unique indexes
protect token hashes, pending sender/email pairs, and invitation-linked jobs; checks constrain
states and prohibit self-association. Existing rows need no backfill. SQL, snapshot and journal
were generated through `npm run db:generate` and applied only to the disposable test database.

## Manual testing setup

Use the existing Node/npm dependencies and Docker test service; no new paid service or dependency
is needed. For the normal local app, apply migrations with `npm run db:migrate`, use the existing
`EMAIL_PROVIDER=local` and loopback `APP_URL`, then run `npm run dev`. Register and verify a
freelancer and a different client email. Use the returned copyable link in local mode; simulated
mail is not sent externally. Hosted delivery uses the existing Resend configuration and maintenance
schedule documented in `docs/EMAIL_DELIVERY.md`; no production settings were changed.

To reproduce the automated invitation tests:

```bash
docker compose up -d postgres-test
node scripts/reset-test-db.mjs
node scripts/run-playwright.mjs tests/e2e/client-invites.spec.ts tests/e2e/client-invites-email.integration.spec.ts --project=chromium --no-deps
```

The harness builds and starts an isolated server on port 3199 and uses only the loopback
`klaveroq_test` database on port 55434. It simulates outbound mail and creates synthetic users.
Reset this disposable database between repeated runs to clear intentional rate-limit tests.
Never set `AUTH_EXPOSE_LOCAL_TOKENS` in hosted environments.

## Validation

- TypeScript: passed.
- Unit tests: 44 files, 235 tests passed.
- Invitation integration/browser suite: 6 tests passed, covering concurrent acceptance and
  agreement creation, ownership, wrong recipients, CSRF, anonymous denial, expiration, replay,
  resend, revoke, decline, quotas, email preference suppression, provider failures/retries,
  expiry audit, new-user verification, existing-user login, recoverable UI failures, and
  desktop/375px mobile agreement creation and freelancer terms acceptance without payment.
- Existing marketplace transaction and email outbox regression suites: 2 tests passed.
- Production build: passed as part of the browser test harness.
- ESLint: no errors; three pre-existing unused-parameter warnings in `server/http/errors.test.ts`.
- `git diff --check`: passed.
- Screenshots: `docs/client-invites/screenshots/` contains history, review, accepted, agreement
  review and freelancer terms screens at 1440px and 375px. Only synthetic test data is shown.

The browser run logs an occasional Next.js “destination stream closed early” message during
rapid navigation; all assertions pass. Real external email delivery and Google OAuth credentials
were not exercised; provider behavior was tested with a stubbed Resend contract.

## Current limits

- Invitation history shows the most recent 100 records. One invitation produces one agreement;
  additional work can use the normal agreement workflow or another invitation.
- Budget currency and fees use the existing CKB agreement workflow (3% client / 2% worker fee
  estimates); this feature does not add NGN payment rails or change transaction-fee rules.
- Terms acceptance records consent only. Actual funding and funded work activation remain with
  the existing PactAgent boundary and are not enabled by this feature.
- Raw copy links are available only immediately after creation/resend. Resend generates a new
  link if the sender did not save it. Maintenance is needed for stored EXPIRED states and expiry
  audit events, but not for enforcement or displayed expiry status.
- No production migration, deployment, push, or merge was performed. Changes remain on
  `feature/client-invites`, based on local `staging`.
