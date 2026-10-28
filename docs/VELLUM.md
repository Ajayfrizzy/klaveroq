# Vellum integration

Klaveroq users can link one active `did:ckb` identity controlled by a verified CKB Testnet wallet.
The identity page lists every DID controlled by those wallets and stores the user's preferred DID.
Klaveroq revalidates the live DID controller immediately before reserving a milestone claim. A
later preference change does not retarget a claim that has already been reserved.

## Settled-milestone claims

The issuer considers a milestone only when all of these conditions hold:

- its `MILESTONE_RELEASE` operation is `CONFIRMED` and references a committed CKB transaction;
- the transaction has the configured confirmation depth;
- the milestone is `RELEASED`;
- the approval belongs to the job's client and references the exact proof submission; and
- the worker's linked DID is still controlled by its verified Testnet wallet.

The `klaveroq.milestone-settlement.v1` payload contains domain-separated hashes of the private job,
milestone, and proof identifiers, the milestone sequence, approval method, settlement block time,
and settlement transaction hash. It does not publish payment amounts, job text, proof contents,
email addresses, or participant details.

Schema support lets Vellum validate and render the evidence. It does not make Klaveroq trusted or
score the claim. Vellum can add the issuer to a versioned reputation policy only after Klaveroq has
provisioned its real issuer DID and published the intended scoring rule.

## Issuer configuration

Claim issuance is disabled unless `KLAVEROQ_VELLUM_ISSUER_ENABLED=1`. Before enabling it:

1. Deploy the PactAgent settlement integration that records the authoritative transaction and marks
   the release `CONFIRMED`.
2. Apply the current database migrations.
3. Create a dedicated CKB Testnet issuer DID and fund its controller with enough capacity for Claim
   Cells and fees.
4. Store the controller key only in the deployment secret manager as
   `KLAVEROQ_VELLUM_ISSUER_CKB_PRIVATE_KEY`.
5. Set `KLAVEROQ_VELLUM_ISSUER_DID`, `KLAVEROQ_VELLUM_MIN_CONFIRMATIONS`, `CKB_NETWORK=testnet`, and
   an explicit `CKB_RPC_URL`.
6. Run the deployment readiness check before serving traffic.

The configured private key must control the live issuer DID. Key rotation keeps the issuer DID
stable: rotate the DID controller first, replace the deployment credential, and verify readiness
before re-enabling issuance. Never put the key in client configuration, logs, fixtures, or support
records.

## Scheduled processing

Use a scheduler that can send an authenticated `POST` to
`APP_URL/api/internal/vellum/claims/retry` every minute with
`Authorization: Bearer <CRON_SECRET>`. The endpoint is idempotent and serializes access to the
funded issuer. It stores the subject, payload, signed transaction bytes, and transaction hash before
broadcast. Retries reuse those exact bytes rather than preparing another transaction.

Monitor `vellum.settlement_claim_run` and `vellum.settlement_skipped` logs. A `REVIEW_REQUIRED`
issuance means the persisted transaction was rejected and deliberately stops the issuer queue.
Inspect the stored transaction and its CKB status before any operator remediation; do not delete the
record or prepare a replacement automatically. Missing PactAgent settlement confirmation is not an
issuance error: operations remain ineligible until Klaveroq records the authoritative committed
transaction and marks the release complete.
