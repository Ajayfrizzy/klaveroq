# Operations Runbook

## Health and monitoring

- `GET /api/health/live`: process liveness only; must not query dependencies.
- `GET /api/health/ready`: database connectivity and production configuration readiness. Route
  traffic only when it returns `200` and `status: ready`.
- Every API response includes `x-request-id`; errors also include `error.requestId`.
- Logs are one-line JSON and exclude request bodies, headers, user identifiers, secrets, and stack
  traces. Search by `requestId`, `event`, status, and error fingerprint.
- Configure `ERROR_MONITORING_WEBHOOK_URL` and optional token for privacy-safe error events. The
  default remains structured stderr for platform collection.

Alert on readiness failure, HTTP 5xx rate, repeated error fingerprint, email retry exhaustion,
pending operations older than policy, retention failures, and unexpected security-hold volume.

## Backup

Use a least-privilege backup credential and encrypted destination:

```bash
DATABASE_URL="$BACKUP_DATABASE_URL" node scripts/backup-db.mjs backups/klaveroq.dump
sha256sum backups/klaveroq.dump > backups/klaveroq.dump.sha256
```

Encrypt before off-host transfer, retain daily/weekly/monthly generations per infrastructure
policy, and test restore monthly. Never commit a dump or checksum containing customer data.

## Restore drill

Create an empty isolated database whose name ends in `_restore_test`, then:

```bash
RESTORE_DATABASE_URL="$RESTORE_DATABASE_URL" node scripts/restore-db.mjs backups/klaveroq.dump
DATABASE_URL="$RESTORE_DATABASE_URL" npm run db:migrate --workspace=@klaveroq/web
psql "$RESTORE_DATABASE_URL" -c "select count(*) from drizzle.__drizzle_migrations"
```

Verify representative user, audit, job, milestone, operation, and file-metadata counts. Files are a
separate encrypted backup set and must be reconciled by storage key. Drop only the isolated drill
database after evidence is recorded.

## Migration rollback

Migrations are forward-only. Before release, take a verified backup and rehearse on a clone. If a
migration fails, stop traffic, capture logs/request IDs, restore the pre-migration backup into a new
database, point the service to it, run readiness checks, and investigate offline. Do not edit an
applied migration or manually mark it successful.

## Incident response

1. Declare severity and incident lead; restrict changes.
2. Use request IDs and safe fingerprints to establish scope. Do not paste credentials or customer
   content into chat/tickets.
3. Contain: disable affected route/provider, revoke sessions or credentials, and preserve audit and
   database/storage evidence.
4. Recover from a verified backup or forward fix; run liveness/readiness and critical browser tests.
5. Notify affected parties and regulators according to legal timelines.
6. Rotate compromised secrets, document the timeline, and create tested prevention actions.

Secret rotation order: create replacement, deploy consumers, verify readiness, revoke old secret,
then review audit/error events. Database and encryption-key rotations require a rehearsed overlap or
data re-encryption plan; never invalidate MFA ciphertext without migration.
