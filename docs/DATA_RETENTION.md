# Data Retention and Account Closure

## Enforced short-lived records

`POST /api/internal/retention/purge`, authenticated by `CRON_SECRET`, enforces:

| Data | Retention |
| --- | --- |
| Expired or revoked sessions | 30 days |
| Consumed or expired verification/reset tokens | 30 days |
| Expired wallet challenges | 7 days |
| Authentication rate-limit windows | 2 days |
| Delivered email bodies and recipient copies | 90 days |

Run daily. The endpoint reports counts only and writes `internal.retention_enforced` to the audit
trail. Failed/pending deliveries are retained so retries and incident diagnosis remain possible.

## Long-lived and legal-hold records

- Audit logs and agreement/financial-operation records: seven years from agreement closure.
- Jobs, milestones, proofs, reviews, disputes, decisions, and settlement intents: seven years.
- Identity verification result and provider reference: seven years after account closure where
  required for fraud/compliance; raw identity documents must remain with the provider and must not
  be copied into Klaveroq.
- Support messages/files: two years after ticket closure unless attached to an active dispute.
- Proposal messages and files: two years after listing closure unless they became agreement or
  dispute evidence.
- Profile and portfolio media: until replacement/deletion or account closure, unless subject to a
  legal hold.

Long-lived deletion is deliberately not automated until jurisdiction, legal-hold, and PactAgent
requirements are configured. This prevents premature destruction of financial/dispute evidence.

## Account closure procedure

1. Verify the requester and reject closure while agreements, disputes, pending operations, security
   holds, or support escalations remain active.
2. Set the account to `CLOSED`, revoke all sessions, disable notification delivery, make the profile
   private, and revoke wallets. Do not claim that on-chain data has been erased.
3. Delete profile/portfolio media and non-evidentiary attachments from storage and database.
4. Pseudonymize display name and email after the recovery/fraud window while retaining the minimum
   immutable agreement, audit, dispute, and operation records required by policy.
5. Record actor, legal basis, retained categories, storage deletions, and completion time in audit.

No self-service closure control is enabled yet because steps 1-5 require the legal-hold and
PactAgent checks that are not configured. Support must not manually delete database rows.
