# Data Retention and Account Closure

## Enforced short-lived records

`POST /api/internal/retention/purge`, authenticated by `CRON_SECRET`, enforces:

| Data                                          | Retention                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Expired or revoked sessions                   | 30 days                                                                                                             |
| Consumed or expired verification/reset tokens | 30 days                                                                                                             |
| Expired wallet challenges                     | 7 days                                                                                                              |
| Authentication rate-limit windows             | 2 days                                                                                                              |
| Notification email bodies                     | Scrub after 90 days; retain delivery/deduplication records and recipient identifiers under account retention policy |
| Authentication email bodies                   | Scrub on acceptance/simulation or token expiry; pending links require restricted, encrypted database access         |

Run daily. The endpoint reports counts only and writes `internal.retention_enforced` to the audit
trail. Failed/pending deliveries are retained so retries and incident diagnosis remain possible.

## Account lifecycle and reviewed retention

M2 adds a 30-day product recovery period, explicit fresh-authentication recovery,
private account tombstones and bounded, opt-in cleanup. See
[the lifecycle design and entity matrix](account-lifecycle/DESIGN.md) and
[operations and activation checklist](account-lifecycle/OPERATIONS.md).

There is no universal seven-year retention rule in the application. Agreement,
financial, audit, identity, dispute, support and shared records require classification
by purpose, jurisdiction, applicable obligation and legal hold. Review dates are
operational reminders, not legal erasure deadlines. No financial/audit evidence is
automatically destroyed by M2.

The short-lived sweeper excludes account/legal holds, active security holds and
suspended/security-review accounts where records have a user association. Rate-limit
keys remain hashed and follow the existing short-lived policy. A preservation request
covering unattributed infrastructure logs needs separate operator handling.

Never manually delete user or profile rows to close an account. The audit FK remains
unchanged. Removing a profile is not account deletion; the application offers explicit
private-profile repair for an authenticated user whose profile was removed.

Account cleanup stays disabled unless `ACCOUNT_CLEANUP_ENABLED=true` is explicitly
configured after the separate activation review. No production schedule is added by M2.
