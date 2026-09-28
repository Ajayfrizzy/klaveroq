# Staging Provider Checklist

## Account preferences and community-beta identity

Verification for this milestone: **149 unit tests passed** across 31 files; **44/44 complete Linux browser/integration tests passed** with snapshot updates disabled; the separate disabled-beta browser/API test passed in Linux and again through its own production-build/server configuration. Production builds for sandbox E2E and disabled beta, typecheck and lint passed (three pre-existing unused-argument lint warnings). The final full run kept application, database and browsers on Linux with isolated temporary uploads after mixed-host tests encountered upload and clock-dependent failures. Existing development databases and credentials were not migrated or changed; the new migration was applied only to newly created isolated test databases. No deployment, commit or push was performed.

Authenticated workspace focus, marketplace saved searches and talent shortlists now use PostgreSQL. Apply migration `0016_panoramic_mister_sinister.sql` through the normal migration command before starting the updated app; never reset an existing database. The three normalized tables enforce allowed focus/scope values, canonical search uniqueness, up to 8 searches per marketplace, and up to 3 distinct non-self shortlist profiles. Concurrent mutations serialize per account and bounded slots enforce caps in the database.

API routes: `GET/PATCH /api/preferences`, `GET/POST/DELETE /api/preferences/saved-searches`, `GET/POST/DELETE /api/preferences/talent-shortlist`, and opt-in `POST /api/preferences/import`. All are session-owned; mutations require same-origin requests, strict validation and audit events. Saved searches persist normalized filters, not external URLs. Comparison loads current public profile data; unavailable entries can be removed.

Legacy account-scoped device keys are inspected only to offer an explicit import when the corresponding server preference is empty. Accepting validates and atomically merges with current account data, preserves an existing server focus and deduplicates collections. Keys are removed only after success and only if unchanged since the prompt. Declining preserves device data and dismisses the prompt for the browser-tab session. Malformed values are ignored. Guest saved searches/shortlists remain device-local; authenticated controls never fall back to device data as authoritative state. Saved searches do not subscribe users to email.

For the hosted community beta, configure:

```env
NODE_ENV=production
DEPLOYMENT_STAGE=community_beta
IDENTITY_PROVIDER=disabled
IDENTITY_SANDBOX_ENABLED=0
```

Do not set `E2E_TEST_MODE` or sandbox secrets on hosted environments. `/api/health/ready` reports `identity: intentionally_disabled_for_beta`; all email, scanner, database, HTTPS and secret requirements still apply. The identity page states that checks are unavailable and not required for beta participation. Start/country/sandbox controls are absent; authenticated starts return 503 `IDENTITY_VERIFICATION_UNAVAILABLE` without inserting a row. Existing records are preserved. Google login, verified email and wallet ownership are not identity verification.

Full production uses `DEPLOYMENT_STAGE=production` and still requires a real implemented identity adapter. **No real identity adapter is implemented in this milestone.** The supported-real-provider registry is deliberately empty: missing, disabled, sandbox and arbitrary provider strings all fail full-production readiness. A policy test exercises a hypothetical registered adapter, but is not evidence of a live provider integration. Integrating, registering and validating signed callbacks/replays/expiry remains a production-only gate. Sandbox is permitted only in guarded local/E2E environments and never in the explicit community-beta or production stage.

Run the regular browser suite plus `node scripts/run-playwright.mjs --config=playwright.beta.config.ts` for the separate disabled-beta server. The `test:e2e` npm command runs both automatically on the disposable test database. For non-destructive local verification, create new isolated databases ending in `_test`, migrate them, and invoke the runner directly instead of the reset wrapper.


Complete this after credentials and staging infrastructure are configured. Store evidence in the
release record, never in this repository. Each owner must test success, rejection, timeout, retry,
duplicate callback, and recovery behavior where the provider supports it.

| Provider gate             | Owner             | Required evidence                                                                        | Status                          |
| ------------------------- | ----------------- | ---------------------------------------------------------------------------------------- | ------------------------------- |
| Resend                    | Platform/auth     | Verification, reset, notification receipt; suppression/failure recovery; dedupe          | Pending                         |
| Google OAuth              | Platform/auth     | First/repeat sign-in, logout, restart persistence, denied consent, no duplicate identity | Pending                         |
| Identity provider (full production only) | Trust/safety | Implement real adapter; signed callback, replay/expiry rejection, pending/failed/verified UI | Beta intentionally disabled; production blocked |
| CKB browser wallet        | Wallet owner      | Supported wallet/network matrix, valid signature, wrong account/network, rejection/retry | Pending connector/configuration |
| Object storage and ClamAV | Platform/security | Upload/download/delete, private authorization, spoof/EICAR quarantine, orphan cleanup    | Pending                         |
| Error monitoring          | Platform/privacy  | Redacted test event, request-ID correlation, alert delivery, access/retention review     | Pending                         |
| Backup destination        | Database owner    | Encrypted backup, checksum, isolated restore, file reconciliation, measured RTO/RPO      | Pending                         |
| Scheduled jobs            | Platform          | Authenticated notification retry and retention runs, alert on failure, overlap behavior  | Pending                         |

## Environment gates

Follow [transactional email configuration and acceptance](EMAIL_DELIVERY.md) for the exact Resend sender/domain, signed webhook, authenticated POST schedule, delivery states and recovery rules. Record live message IDs and confirmed webhook delivery separately from automated mocked-provider results.

- [ ] `APP_URL` is HTTPS and matches OAuth/provider callbacks and allowed origins.
- [ ] Session, cron, monitoring, MFA-encryption, database, storage, and provider credentials are
      unique to staging and delivered through the secret manager.
- [ ] `/api/health/ready` returns `200` with every required production-style dependency configured.
- [ ] Sandbox identity and internal test routes are unavailable under hosted production settings.
- [ ] Local email, local file scanner, and filesystem-only storage are not active.
- [ ] Provider dashboards use least-privilege access, MFA, retention limits, and named owners.

## Manual accessibility and browser pass

- [ ] Complete VoiceOver/Safari and NVDA/Firefox journeys for registration, sign-in, discovery,
      proposal, support, security, and administrator navigation.
- [ ] Confirm announcements for validation, loading, errors, success, dialogs, and route changes.
- [ ] Verify contrast and focus appearance in normal, high-contrast, 200% zoom, and reduced-motion
      settings using the release browser/device matrix.
- [ ] Check long translated-like content, long IDs, filenames, wallet addresses, and user agents at
      320 px through wide desktop widths.

## PactAgent boundary

PactAgent is not part of this checklist until its contract and environment are ready. Do not enable
worker acceptance, funding-dependent controls, balances, releases, refunds, or settlement claims
from local database state. Its later staging plan must cover signing, chain submission, confirmation
depth, reconciliation, idempotent retries, failed operations, refunds, dispute splits, and finality.
