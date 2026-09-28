# Transactional email operations

## Hosted configuration

Use a Resend account and a sending domain you control (for example `mail.yourdomain.com`). There is no repository-owned sending domain or credential. Add the exact SPF and DKIM DNS records supplied by Resend, configure DMARC for the domain, and wait for Resend to report the domain verified. Do not use `example.com` or Resend's onboarding sender for community beta recipients.

Configure these in the hosting secret manager; never commit their values:

| Variable | Required hosted value |
| --- | --- |
| `EMAIL_PROVIDER` | `resend` |
| `RESEND_API_KEY` | Sending-enabled API key scoped to the verified sending domain |
| `EMAIL_FROM` | `Klaveroq <accounts@mail.yourdomain.com>`, using your verified domain |
| `APP_URL` | Public HTTPS origin, e.g. `https://beta.yourdomain.com`, with no path, query or credentials |
| `RESEND_WEBHOOK_SECRET` | Resend webhook signing secret beginning `whsec_` |
| `CRON_SECRET` | Independent random secret, at least 32 characters |

Configure a Resend webhook at `APP_URL/api/webhooks/resend`, subscribing to `email.delivered`, `email.bounced`, `email.complained`, `email.failed`, and `email.suppressed`. No OAuth callback is needed for Resend. The Google callback remains unchanged. Open/click tracking is not required. The handler verifies Svix HMAC signatures over raw request bytes with a five-minute timestamp tolerance; keep host clocks synchronized. Unknown receipt IDs return 503 so an event that arrives before the send receipt is committed can be retried. Duplicate and older events cannot regress the recorded state.

Run an authenticated **POST** to `APP_URL/api/internal/notifications/retry` every minute. Send `Authorization: Bearer <CRON_SECRET>` as a secret header, never a URL parameter. A GET-only scheduler is insufficient: use a scheduler supporting POST and secret headers. Give the worker up to 300 seconds. Each run enqueues up to 100 new security events and attempts up to 25 due emails; overlapping scheduled runs return `already_running`. Database claims also prevent duplicate attempts from overlapping request handlers. Run `POST /api/internal/retention/purge` daily using the existing cron credential.

## Delivery semantics and recovery

- `SIMULATED`: local development only; no provider request, receipt or delivery timestamp.
- `ACCEPTED`: Resend returned an email ID. This is not delivery confirmation.
- `DELIVERED`: a verified provider event says the receiving mail server accepted delivery; it does not prove the user opened it or that it reached the inbox rather than spam.
- `PENDING`, `PROCESSING`, `FAILED`: queued, leased, or waiting for retry.
- `PERMANENT_FAILURE`, `BOUNCED`, `COMPLAINED`, `SUPPRESSED`: terminal rejection, recipient/provider failure, or preference suppression. They are not automatically resent.
- `EXPIRED`: an authentication token expired or was replaced/consumed.
- `REVIEW_REQUIRED`: retries were exhausted or the safe idempotency window elapsed. Do not blindly requeue these records.
- `LEGACY_UNCONFIRMED`: historical code marked a send delivered without proof. Migration preserves the record and its historical timestamp as unverified evidence, but removes the unsupported delivery status; historical pending sends also require manual review. Only `DELIVERED` rows with provider receipts count as confirmed delivery.

Each logical notification has a unique database key, and each provider request uses the same `Idempotency-Key` and immutable payload across retries. Resend retains keys for 24 hours; automatic retry stops after 23 hours from the first attempt, or after five attempts. Retries back off from one minute, honor Retry-After, and recover PROCESSING leases after ten minutes. Network errors and timeouts are ambiguous: inspect the provider receipt before any manual resend. A crash after acceptance is retried with the same key; exact-once delivery beyond the provider's retention window cannot be guaranteed, so it is stopped for review. Do not switch sending domains/accounts or change queued payloads while retrying ambiguous sends.

Optional preferences apply both when queued and before send. Security and authentication emails bypass optional preferences. Security events remain committed with existing auth/wallet transactions and are bridged by the scheduler, without changing Google OAuth. Only events since migration installation are bridged, avoiding a historical-alert flood. Marketplace, proposal, invitation, award, dispute and support notifications use their existing authorized destinations. Email summaries omit message bodies, support replies, dispute evidence and customer-supplied titles; sign-in is required to read details.

Authentication emails use the same outbox with token expiry checks. Links are removed from stored bodies on provider acceptance/local simulation or expiry. Treat pending outbox bodies as sensitive credentials: restrict database/backup access and encrypt storage. Retention scrubs other bodies after 90 days while retaining delivery keys to prevent replays. Application logs contain delivery IDs, status, attempt counts and safe error codes, not email addresses, tokens or provider response bodies.

## Monitoring and live acceptance

Alert on missing successful cron runs for five minutes, growing FAILED/PENDING backlogs, any REVIEW_REQUIRED/PERMANENT_FAILURE records, webhook 401/503 spikes, and provider bounces/complaints. Cron JSON returns aggregate counts by status; `email.retry_run` and `email.attempt_completed` logs provide run/attempt evidence. Provider outage must not silently fall back to the local provider. Review domain/API-key configuration before resuming; never reset attempts to force a resend without confirming provider history.

Before beta, use controlled recipient mailboxes and record Resend message IDs and webhook outcomes for verification, password reset, sign-in/MFA/password/wallet security alerts, proposal/message/invitation/award/dispute/support notifications. Follow verification/reset links in a browser, test single-use expiry, check plain text and HTML on mobile, confirm optional opt-outs and mandatory security delivery, and inspect bounce/suppression behavior. Verify signed webhook retries, duplicate delivery events and scheduled overlap in staging. Do not put tokens, email bodies or credentials in evidence files.

Automated provider tests use mocked Resend HTTP responses and isolated PostgreSQL databases. They do not certify a real sending domain, DNS propagation, API key, inbox receipt, provider webhook routing or hosted scheduling. These live checks require the owner's Resend credentials and hosting configuration.

## Verified implementation evidence — September 28, 2026

- Production build, TypeScript and lint passed; lint reports three pre-existing unused-argument warnings in the HTTP wrapper test.
- 128 unit tests passed. All 40 browser/integration tests passed in Linux, including Chromium, Firefox, WebKit and mobile, with visual snapshot updating disabled.
- Email integration exercises Resend request/receipt contracts with fake credentials, all notification categories, provider rejection, ambiguous acceptance, repeated/concurrent sends, interrupted attempts, retry caps, stale authentication links, preferences at send time, mandatory security messages, signed/replayed/out-of-order webhooks, and cron authentication/overlap. Verification and password-reset links generated through the mocked Resend boundary were followed in a real browser.
- The app and browsers shared the Linux clock for final acceptance. Earlier mixed-host runs exposed Mac/Docker clock skew in unrelated unread-message and TOTP tests. The final run passed those unchanged workflows.
- Existing visual references were refreshed solely to match the profile/avatar, wallet hint and Activity changes already present before this email task. Application UI and Google OAuth code were unchanged.

No live provider receipt or real inbox delivery is claimed by these results. Complete the controlled-mailbox staging checks above before community beta hosting.
