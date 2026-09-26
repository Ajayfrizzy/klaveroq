# Staging Provider Checklist

Complete this after credentials and staging infrastructure are configured. Store evidence in the
release record, never in this repository. Each owner must test success, rejection, timeout, retry,
duplicate callback, and recovery behavior where the provider supports it.

| Provider gate             | Owner             | Required evidence                                                                        | Status                          |
| ------------------------- | ----------------- | ---------------------------------------------------------------------------------------- | ------------------------------- |
| Resend                    | Platform/auth     | Verification, reset, notification receipt; suppression/failure recovery; dedupe          | Pending                         |
| Google OAuth              | Platform/auth     | First/repeat sign-in, logout, restart persistence, denied consent, no duplicate identity | Pending                         |
| Identity provider         | Trust/safety      | Signed callback, replay/expiry rejection, pending/failed/verified UI, provider label     | Pending selection/configuration |
| CKB browser wallet        | Wallet owner      | Supported wallet/network matrix, valid signature, wrong account/network, rejection/retry | Pending connector/configuration |
| Object storage and ClamAV | Platform/security | Upload/download/delete, private authorization, spoof/EICAR quarantine, orphan cleanup    | Pending                         |
| Error monitoring          | Platform/privacy  | Redacted test event, request-ID correlation, alert delivery, access/retention review     | Pending                         |
| Backup destination        | Database owner    | Encrypted backup, checksum, isolated restore, file reconciliation, measured RTO/RPO      | Pending                         |
| Scheduled jobs            | Platform          | Authenticated notification retry and retention runs, alert on failure, overlap behavior  | Pending                         |

## Environment gates

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
