# Account lifecycle operations (not activated)

## API contracts

Browser mutation routes use existing same-origin protection and the shared lifecycle gate;
cron uses a constant-time bearer credential instead of browser origin. Sensitive fields
must never be logged. Ordinary JSON errors include the existing request correlation ID.

| Endpoint                              | Authorization / input                                                                                                        | Result                                                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| POST `/api/account/closure`           | email, current password or action-bound email token for passwordless accounts, MFA code if enabled, `confirmation: "DELETE"` | request ID, PENDING_DELETION and database-clock `processAfter`; repeated password-authenticated requests return the same pending request |
| POST `/api/account/recover`           | same credentials, recovery-purpose token if passwordless, `confirmation: "RECOVER"`                                          | recovery confirmation; no automatic session; sign in again                                                                               |
| POST `/api/account/confirmation`      | email, action delete/recover; delete requires matching signed-in identity                                                    | generic accepted response; eligible passwordless verified accounts receive a single-use ten-minute link; no production token response    |
| POST `/api/account/repair-profile`    | ordinary authenticated user, displayName                                                                                     | creates only a missing PRIVATE profile; never overwrites existing profile                                                                |
| POST `/api/account/privacy`           | contact email and 10–2000-character message, rate limited                                                                    | request reference; no account-existence disclosure or automatic state change                                                             |
| POST `/api/admin/account-holds`       | RISK_ADMIN/SUPER_ADMIN; userId, reason; optional releaseId                                                                   | audited hold placement/release; placement revokes sessions/tokens and hides profile                                                      |
| GET `/api/admin/account-requests`     | RISK_ADMIN/SUPER_ADMIN                                                                                                       | latest 50 closure, hold and privacy records per category                                                                                 |
| POST `/api/internal/accounts/cleanup` | CRON_SECRET of at least 32 characters and ACCOUNT_CLEANUP_ENABLED=true                                                       | at most 10 due requests; processed/deferred/failed counts; HTTP 503 if any cleanup fails                                                 |

Deletion/recovery attempts have both IP and account-wide quotas (15 and 8 respectively
per 15 minutes). Quotas are committed independently of the transition transaction so
failed authentication cannot roll back its attempt count. Password verification occurs
on each action; Google-only accounts use their verified email as the secure alternative,
not a borrowed session. A confirmation link alone performs no state mutation. Enabled
MFA still requires a fresh TOTP or atomically consumed recovery code. Expired/replayed
email credentials fail. Existing locked accounts cannot use this flow to bypass lockout.

Email confirmation bodies use the existing AUTH outbox category, are expiry-checked and
scrubbed on acceptance/simulation/expiry. Lifecycle notices use SECURITY outbox entries
created in the transition transaction. Provider failures are retried by the existing
notification retry worker; the UI confirms the account action, never inbox delivery.

## State rules

- Eligible ACTIVE or unverified accounts may request closure; privileged staff accounts
  need manual review. All ordinary sessions and outstanding auth/wallet challenges are
  revoked. Profile visibility is saved and hidden; open listings close, submitted
  proposals withdraw and pending sent client invitations revoke.
- Pending accounts cannot sign in normally or mutate marketplace data. Explicit recovery
  is allowed strictly before the deadline with valid credentials and no holds. Verified
  accounts return ACTIVE; never-verified accounts remain unverified. Only previously
  public and still-complete profiles return to public visibility. Listings/invitations
  are not reopened automatically. Another closure creates a new independent deadline.
- SUSPENDED, SECURITY_REVIEW, RESTRICTED, CLOSED and final lifecycle states cannot use
  password/OAuth/session entry points, verify-email or password reset to resume activity.
  A new account/legal hold also blocks ordinary access. Existing short wallet-change
  holds still block closure/recovery and retention, without changing ordinary sign-in.
- Active jobs/deliverables, unfinished payment operations, unresolved failed financial
  operations, disputes, security holds or open security/payment/dispute support cases
  defer closure. Historical COMPLETED/CANCELLED/etc. jobs and CONFIRMED operations do
  not themselves block it. A support review must resolve inconsistent terminal records.
- Cleanup rechecks state, deadline, obligations and holds. Held/blocked records remain
  pending and receive a one-day review reminder; the public privacy route remains usable.
  After the deadline, only authorized support review can consider an exception; ordinary
  recovery cannot bypass it.

## Scheduling and visibility

No hosted settings or schedule are changed by this milestone. Cleanup defaults off.
After separate activation, invoke the cleanup POST daily (or in bounded repeated calls
until the due queue is drained), with the secret in an encrypted header. Never put
secrets in URLs. Existing notification retry scheduling delivers notices independently.

Account/admin-account request bodies are bounded to 16 KiB and must finish within
ten seconds before acquiring the exclusive gate. Browser origins are checked before
lock acquisition. Future enabled multipart upload handlers must preserve bounded upload
handling and avoid holding a gate for an unbounded stream; uploads remain disabled in
this beta.

The exclusive transaction advisory gate serializes cleanup with all app mutations,
including counterparty actions. A separate pool (max 2) holds coordination locks; allow
these extra database connections in capacity planning. Lock acquisition times out after
15 seconds, causing a safe request failure rather than unbounded queuing. A ten-account
cleanup batch prioritizes beta correctness over throughput. Avoid large/slow provider
calls or future background writes outside the gate. GET OAuth callback explicitly joins
the shared gate. Read-only in-flight responses may finish, but revoked sessions fail on
subsequent requests.

Each account cleanup is transactional. A failure rolls back its changes, records only
CLEANUP_FAILED and a one-hour retry time, logs a request ID, and leaves other accounts
eligible to progress. Alert on HTTP 503, `account.cleanup_failed`, old due records and
`last_error`. The admin read API exposes pending reviews and retention reasons. Staff
must review privacy requests daily and verify ownership through approved support
procedures before applying an exception. The first implementation exposes the queue
through a privileged API, not a new admin dashboard. Beyond its latest-50 window, use a
restricted operational query/export for backlog review; do not silently ignore overflow.

Completed retained records carry category reasons and a 90-day review reminder. This
is not an automatic purge date. Reasons cover financial/agreement, shared counterparty,
security/identity/media and the minimal audit anchor. Review job text, delivery traces,
provider references and media on a case-by-case basis. Objects are not deleted by this
job; private metadata continues to protect them from orphan cleanup until reviewed.

## Migration and recovery strategy

Generated migration: `20261031151510_account_lifecycle.sql`, snapshot and journal entry.
It adds three enum values and three tables; it does not change existing rows or FKs.
The test migration was applied to a populated disposable database after reproducing the
profile issue, then exercised through all lifecycle scenarios.

Before integration with Vellum PR #5: it currently has its own 0018 migration. The M2
SQL/snapshot names avoid filename collisions, but both journals branch from 0017.
Whichever feature integrates second must regenerate its additive migration with Drizzle
against the first feature's merged snapshot/history and combined schema, then run a
fresh and populated upgrade test. Do not concatenate divergent journals or edit generated
SQL/snapshots by hand. Vellum was inspected read-only and not modified.

Use a verified database backup and test restore before applying the additive migration
in an approved deployment. Keep the previous build artifact. Rollback of app behavior is
NOT safe to a pre-M2 build while any pending/final lifecycle state exists: old code may
not recognize the new states. Disable cleanup first and prefer a forward fix retaining
all guards/evidence. Enum values cannot safely be dropped in place. Do not drop lifecycle
tables or erase requests to force a rollback. Restoration from backup must preserve or
reconcile subsequent requests, audit entries and financial changes under operator review.

## Separate activation checklist

- [ ] Review code, state guards, migration history and legal retention classification.
- [ ] Reconcile the Vellum migration branch if it has merged first; validate combined history.
- [ ] Test migration/restore with a disposable copy, including preexisting accounts and evidence.
- [ ] Approve jurisdiction/purpose-specific retention rules and assign a privacy-review owner.
- [ ] Confirm the admin queue is reviewed, alerting works, and late obligations have a support path.
- [ ] Confirm email provider/retry scheduling, MFA configuration and trusted proxy rate-limit headers.
- [ ] Verify provider state can be reconciled before real payments are enabled; beta checks cover
      local records only. Keep cleanup off if external financial obligations cannot be established.
- [ ] Confirm capacity for the coordination pool and migration rollout across all app instances.
- [ ] Apply the additive migration only under separately authorized deployment instructions.
- [ ] Deploy all lifecycle guards before exposing deletion, then test recovery end to end.
- [ ] Only after approval, set ACCOUNT_CLEANUP_ENABLED=true and configure the protected schedule.
- [ ] Run a bounded supervised batch, verify audit/record preservation and monitor failures.

No item authorizes this agent to activate cleanup or modify hosted data during M2.

## M3 policy integration

The current `/account/privacy` route is an operational request form, not a published
legal policy. Add links to approved privacy/retention policy pages from settings and
recovery when M3 supplies them. Do not expose placeholder legal URLs or claim a legal
basis that has not been reviewed.
