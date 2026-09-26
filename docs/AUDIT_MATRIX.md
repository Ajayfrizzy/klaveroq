# Audit Matrix

Every `POST`, `PUT`, `PATCH`, and `DELETE` route under `apps/web/src/app/api` must call `audit()`.
`src/server/audit-coverage.test.ts` enforces this rule. Audit records include actor when known,
target type/ID, action, timestamp, correlation ID, hashed client IP, and allowlisted safe metadata.
Free-form messages, evidence, reasons, credentials, tokens, wallet addresses, and email addresses are
not stored in audit metadata.

| Endpoint(s) | Mutation | Audit action or family | Target |
| --- | --- | --- | --- |
| `/api/auth/register`, `/login`, `/logout` | Account/session creation or revocation | `account.registered`, `session.created`, `session.current_revoked` | user/session |
| `/api/auth/google/callback` | Federated sign-in | `session.google_created` | user |
| `/api/auth/password/request`, `/reset` | Reset request/completion | `account.password_reset_*` | user |
| `/api/auth/verify-email/**` | Verification issue/completion | `account.email_verification_*` | user |
| `/api/auth/mfa/**` | MFA setup/challenge/disable | `mfa.*` | user/MFA method |
| `/api/auth/sessions/[id]` | Remote session revocation | `session.revoked` | session |
| `/api/profile`, `/visibility`, `/avatar`, `/portfolio/**` | Public profile/media changes | `profile.*`, `portfolio.*` | profile/media/item |
| `/api/identity`, `/identity/sandbox/complete` | Identity start/status transition | `identity.*` | verification |
| `/api/wallets/challenge`, `/verify`, `/[id]` | Wallet challenge/verify/default/revoke | `wallet.*` | challenge/wallet |
| `/api/fees/quote` | Fee-policy quote | `fee_quote.created` | quote |
| `/api/jobs`, `/jobs/[id]/confirm`, `/accept` | Agreement creation/state transition | `job.*` | job |
| `/api/jobs/[id]/cancellation` | Request/accept/decline/refund intent | `job.cancellation_*`, `job.*refund_requested` | job |
| `/api/jobs/[id]/disputes` | Dispute opening | `dispute.opened` | dispute |
| `/api/jobs/[id]/reviews` | Marketplace review | `marketplace_review.created` | review |
| `/api/marketplace/listings`, `/[id]`, `/publish`, `/close`, `/cancel` | Listing lifecycle | `listing.*` | listing |
| `/api/marketplace/listings/[id]/proposal`, `/proposals` | Proposal lifecycle | `proposal.*` | proposal |
| `/api/marketplace/proposals/[id]/award`, `/reject`, `/shortlist` | Client proposal decision | `proposal.*` | proposal |
| `/api/marketplace/proposals/[id]/messages` | Participant message | `proposal.message_created` | message |
| `/api/milestones/[id]/proofs`, `/proofs/[id]/files` | Proof and evidence upload | `milestone.proof_submitted`, `proof.file_uploaded` | proof/file |
| `/api/milestones/[id]/review` | Approval or revision | `milestone.proof_approved`, `milestone.revision_requested` | milestone |
| `/api/disputes/[id]/evidence` | Dispute evidence | `dispute.evidence_submitted` | evidence |
| `/api/admin/disputes/[id]/decision` | Two-person decision | `admin.dispute_decision_*` | decision |
| `/api/notifications/[id]/read`, `/read`, `/preferences` | Inbox/preferences | `notification.*` | notification/inbox/preferences |
| `/api/support/tickets`, `/[id]/**` | Ticket/message/file/state changes | `support.*` | ticket/message/file |
| `/api/admin/support/tickets/[id]/**` | Assignment/status/reply | `admin.support.*` | ticket/message |
| `/api/ai/job-builder`, `/proposal-assistant` | Draft generation request | `ai.*` | user/listing |
| `/api/internal/jobs/[id]/sandbox-fund` | E2E-only funding simulation | `internal.sandbox_funding_confirmed` | job |
| `/api/internal/reviews/auto-approve` | Scheduled auto-review | `internal.milestone_auto_approved` | milestone |
| `/api/internal/security-holds/release` | Scheduled wallet hold release | `internal.security_hold_released` | hold |
| `/api/internal/retention/purge` | Scheduled retention enforcement | `internal.retention_enforced` | retention run |

Audit writes occur only after the authoritative mutation succeeds. Business state and audit rows are
separate writes today; operational alerts must treat a missing audit after a successful mutation as
an incident. Phase 8 should evaluate a transactional outbox if audit availability requirements
demand atomic business-and-audit persistence.
