# Community beta: private uploads on App Platform

Implementation is prepared locally; no deployment, database migration, reset, bucket operation, commit or push is part of this change. The service settings are in [`deploy/digitalocean/app.yaml`](../deploy/digitalocean/app.yaml). This is a merge template for the existing app, not a replacement for its full specification or secrets.

## Storage and authorization contract

The web service sends bytes to Spaces through the server-side AWS S3 SDK, with explicit `private` object ACLs. Buckets must also remain private: a public bucket policy would override the intended privacy. No CDN, browser S3 credentials, public object URLs, presigned upload URLs or public download redirects are used.

Uploads keep the existing file limits: 5 MiB avatars, 25 MiB per other file, 10 files/100 MiB aggregate proof limits, and the existing support limits. Content-derived JPEG/PNG/WebP/PDF/UTF-8 text detection and per-route allowed types run before storage. Client filenames and MIME declarations do not establish type. Quarantine and clean objects are isolated under:

```
<SPACES_PREFIX>quarantine/YYYY-MM-DD/<uuid>.<extension>
<SPACES_PREFIX>clean/YYYY-MM-DD/<uuid>.<extension>
```

The sequence is private quarantine PUT → ClamAV INSTREAM scan of the same bytes → private clean PUT of those scanned bytes → quarantine DELETE → metadata insert/transaction. Only an exact clean scanner verdict allows promotion. Malware gives 422; an unavailable scanner or storage gives 503. There is no hosted fallback to the local scanner or filesystem. Scanner framing uses bounded writes, a 10-second inactivity timeout and a 30-second total deadline; storage requests use bounded connection/request timeouts and retries.

Existing `storage_key`, `content_type`, `size_bytes`, `sha256`, `scan_status` and ownership/relationship metadata remain valid. The reviewed migration journal runs from `0000` through `0016_panoramic_mister_sinister`; no new schema or migration is required. `media_files`, `proof_files`, `dispute_files` and `support_attachments` are all covered. All routes explicitly insert `CLEAN` only after successful scanning, including support attachments whose existing schema default is `CLEAN`.

Proof downloads require a job participant; dispute files require a participant or authorized dispute administrator; support attachments require the ticket owner or support administrator, with internal-message restrictions. Avatar and portfolio bytes now also require authentication. Signed-in viewers can see media on public profiles; private media is owner-only. Anonymous visitors can still view public profile text, but uploaded media is not delivered to them. All file responses use `private, no-store`, and quarantine keys are never downloadable.

Replacement commits the new metadata before removing old bytes. Database failures attempt to remove new bytes. Deletion removes references before deleting bytes. Storage and PostgreSQL cannot share a transaction: a crash or failed delete can leave an inaccessible orphan, so the cleanup job below is required. A delete/replacement may return an error after its database transaction has committed if object deletion fails; inspect metadata rather than blindly assuming the prior state is intact.

## Required environment settings

Set these on the **web component**, with `RUN_TIME` scope. They must never be `NEXT_PUBLIC_*` variables. `.env.example` documents development defaults; do not copy development scanner/storage values to beta.

| Variable | Hosted value | Secret? |
| --- | --- | --- |
| `FILE_STORAGE_BACKEND` | `spaces` | No |
| `SPACES_REGION` | Spaces region, e.g. `ams3` | No |
| `SPACES_ENDPOINT` | Regional API, e.g. `https://ams3.digitaloceanspaces.com`; no trailing slash, bucket name or CDN hostname | No |
| `SPACES_BUCKET` | Dedicated private beta bucket name | No |
| `SPACES_PREFIX` | `community-beta/`; required trailing slash, stable across releases | No |
| `SPACES_ACCESS_KEY_ID` | Spaces access key scoped to this bucket | **Yes: encrypted deployment secret** |
| `SPACES_SECRET_ACCESS_KEY` | Matching Spaces secret | **Yes: encrypted deployment secret** |
| `FILE_SCANNER` | `clamav` | No |
| `CLAMAV_HOST` | App Platform binding `${clamav.PRIVATE_DOMAIN}` | No |
| `CLAMAV_PORT` | `3310` | No |
| `CRON_SECRET` | Keep existing secret, minimum 32 characters | **Yes** |

`FILE_STORAGE_ROOT` is used only for development/test filesystem storage and is ignored by Spaces. Region, bucket and prefix are part of the location of every existing object: changing any of them without transferring objects breaks existing metadata references. Use separate buckets and credentials for beta, development and future production; prefixes add isolation within a bucket but do not replace credential boundaries.

## Spaces setup

1. Create a dedicated Space in the selected region (the example pairs App Platform `ams` with Spaces `ams3`). Keep file listing private and do not enable a public bucket policy, public object ACLs, CDN or static website access. Browser CORS is unnecessary because all transfers go through the web server.
2. Create a limited Spaces key scoped to this bucket, permitting object read/write/delete and listing. The SDK needs `PutObject` with private ACL, `GetObject`, `DeleteObject`, and `ListObjectsV2`/bucket listing. It does not need permissions to create/delete buckets. If the UI offers a bucket-scoped Read/Write/Delete grant, use it. Use a separate administrative credential for bucket configuration.
3. Enter the key ID and secret directly in App Platform's encrypted environment-variable fields on the web component. Do not put real credentials into this YAML, `.env.example`, Git, build arguments, public logs or screenshots. Grant these secrets only to the web service (and a transfer tool only during a controlled import), not ClamAV.
4. Do not configure automatic expiry on `clean/`: a referenced file may be old but still needed. The reference-aware collector is the primary orphan policy. Keep bucket versioning disabled for this beta unless a separately reviewed noncurrent-version retention/deletion policy is configured: plain S3 DELETE otherwise leaves prior bytes behind as versions. Do not add object locks that would prevent requested deletions.
5. Leave App Platform disks ephemeral; they hold no user upload bytes in Spaces mode. ClamAV's signature cache is disposable and is rebuilt from the signature-bearing image plus FreshClam updates.

## Exact service configuration and safe merge

The YAML defines two services and routes only `web` through ingress:

- `web`: `Ajayfrizzy/klaveroq`, repository root `/`, Node buildpack, `npm ci --include=dev && npm run build`, and `npm exec --workspace=@klaveroq/web -- next start --hostname 0.0.0.0 --port 8080`. Baseline 2 GiB memory, one instance; monitor peak memory under concurrent multipart uploads. Readiness uses `/api/health/ready`; liveness uses `/api/health/live`.
- `clamav`: Docker Hub **`clamav/clamav:1.4`**, official Linux Alpine image with signature databases included (the maintained 1.4 LTS feature tag follows patch/image updates). Do not use `_base`, an unofficial image or a development tag. Keep the image entrypoint: it starts both clamd and FreshClam. The selected plan is **`apps-s-2vcpu-4gb`** (4 GiB), allowing signature load/reload headroom. Confirm availability/pricing in the selected region before applying.
- ClamAV has **only `internal_ports: [3310]`**, no HTTP port, no route, and no ingress rule. The web host binding is `${clamav.PRIVATE_DOMAIN}`, not localhost or an Internet address. Do not expose clamd through a public domain or load balancer: its TCP protocol has no application authentication.
- TCP readiness targets 3310 after a 120-second initial delay, with 48 failures at 10-second intervals permitted while signatures load. Liveness starts at 600 seconds and checks every 30 seconds. `CLAMD_STARTUP_TIMEOUT=600` bounds the image's own startup wait. App Platform TCP checks establish a listening daemon, not a clean scan verdict; the acceptance tests below must verify INSTREAM and signature freshness. The app always requires a clean verdict per upload regardless of health status.
- `CLAMAV_NO_FRESHCLAMD=false` and `FRESHCLAM_CHECKS=24` keep hourly signature checks enabled. The image's FreshClam configuration notifies clamd after updates. Allow outbound DNS and HTTP/HTTPS to official signature mirrors. Monitor FreshClam errors/rate limits and signature age; treat signatures older than 24 hours as an operational incident and stop new uploads by disabling the scanner until resolved if updates cannot be restored. Re-pull the maintained image for scheduled security maintenance; an already-running container does not update its ClamAV executable by itself.
- Stream/file scan limits are 30 MiB (above the app's 25 MiB individual-file cap), total decompressed scan limit 100 MiB, and `AlertExceedsMax=yes` rejects content exceeding scanner limits instead of silently treating an incomplete scan as clean.

Prepare the existing app spec for review before any application:

1. Export the existing app specification from the dashboard, or use `doctl apps spec get YOUR_APP_ID > /secure/path/existing-app.yaml`. Keep exported secrets/specs outside the repository.
2. Merge the **new `clamav` service** and the web service's storage/scanner environment variables from `deploy/digitalocean/app.yaml`. Match the existing web component's actual name in ingress and component settings; do not create a duplicate web service if it has another name. Set its root build/start settings as shown if they differ. Keep `deploy_on_push: false` until an operator deliberately chooses otherwise.
3. Replace the bucket placeholder, choose matching region/endpoint, and enter both credentials as encrypted runtime secrets through the dashboard. Preserve existing app name/region/domain/ingress settings rather than replacing them with example values. There must be no ingress rule to ClamAV and no default route added for it by the UI.
4. Preserve the existing **beta `DATABASE_URL`**, session/MFA secrets, `APP_URL`, Resend sender/API/webhook settings, Google OAuth client ID/secret and callback URLs, notification/retention scheduler credentials, monitoring settings, `DEPLOYMENT_STAGE=community_beta`, and `IDENTITY_PROVIDER=disabled`. Keep `NODE_ENV=production`; do not set `E2E_TEST_MODE` or identity/local-scanner bypasses. Account-based preferences and the `0016` tables remain untouched. No PactAgent integration is included.
5. Validate the merged candidate with `doctl apps spec validate /secure/path/merged-app.yaml` when doctl is available. This repository's template deliberately omits unrelated existing secrets and is **not** a complete replacement app spec. Review the diff and obtain the normal deployment approval; no deployment command is run by this work.
6. Do not reset, seed, recreate or drop the beta database. This storage change needs no migration. If beta is behind existing migrations, review/back up and use the existing forward-only `npm run db:migrate` process separately. Never run `test:e2e`, `test:integration` or `scripts/reset-test-db.mjs` against beta.

### Existing uploaded files before switching backends

Before any rollout, inventory existing file metadata and check whether filesystem uploads exist on the current web container. Pause uploads and orphan cleanup during a storage transfer. Back up those bytes **before** a redeployment destroys an ephemeral filesystem. Transfer existing `clean/YYYY-MM-DD/...` files into `<SPACES_PREFIX>clean/YYYY-MM-DD/...` without changing the relative keys stored in PostgreSQL. Use private ACLs and existing content types, and verify byte length and SHA-256 against every metadata row before switching the web service to Spaces. Do not import `PENDING`/infected or unscanned bytes as clean; investigate or rescan them. Missing source files cannot be recovered from database hashes—recover a backup or report the affected records; do not delete beta metadata to conceal the loss.

For a controlled copy using a separately configured, short-lived AWS CLI profile with the limited Spaces key, the per-file command is:

```sh
aws --profile klaveroq-transfer --endpoint-url https://ams3.digitaloceanspaces.com \
  s3 cp /secure/backup/uploads/clean/YYYY-MM-DD/UUID.ext \
  s3://YOUR_PRIVATE_BUCKET/community-beta/clean/YYYY-MM-DD/UUID.ext \
  --acl private --content-type ACTUAL_CONTENT_TYPE --cache-control 'private, no-store'
```

Download each copied file with that private profile to a verification directory and compare its size/hash to metadata. S3 ETag is not a SHA-256 checksum. Keep the source backup until authenticated downloads and redeployment persistence pass. Do not run cleanup while references or files are being restored. A code rollback must retain a Spaces-capable version and the same bucket/prefix; rolling back to filesystem-only code cannot read Spaces files.

## Orphan cleanup and failure recovery

Schedule a daily run of `scripts/cleanup-upload-orphans.mjs` on a trusted scheduler with only HTTPS `APP_URL` and the existing `CRON_SECRET` injected as a secret. Node 22+ is required. It POSTs to `/api/internal/files/cleanup` and follows all continuation pages for both prefixes. The route uses constant-time cron credential comparison, validates its body, and records audit counts without credentials or filenames.

```sh
# Review counts first (default dry run):
node scripts/cleanup-upload-orphans.mjs
# Configure this daily only after the inventory/transfer and acceptance checks:
node scripts/cleanup-upload-orphans.mjs --apply
```

Each request handles at most 100 listed objects, with a fixed 24-hour age grace to avoid racing uploads whose metadata is still being committed. Before deleting each old object, it checks **all four file tables plus `profiles.avatar_key` and `portfolio_items.media_key`**. A database error aborts; it never means “unreferenced.” Storage/list/delete errors stop the run and should alert the scheduler operator; the next run can retry idempotently. Only app-shaped keys under the configured environment's clean/quarantine prefixes are eligible. Object metadata is never a substitute for database authorization. Keep the same prefix across deployments and do not restore old metadata concurrently with cleanup.

A raw API call accepts `{ "prefix": "clean/", "dryRun": true, "cursor": "optional-next-token" }` and returns counts plus the next cursor. Dry run is the default. Repeat with `quarantine/`. Do not print authorization headers in logs.

## Automated verification

Run `npm test`, `npm run typecheck`, and `npm run lint`. Unit tests mock Spaces requests, ClamAV sockets/verdicts, database calls and session authorization; they never contact the beta database or real bucket/scanner. Coverage includes private quarantine/clean writes, byte framing, clean/malware/error verdicts, timeouts and premature close, size/type policy, ambiguous writes and rollback, storage read/write/delete outages, replacement/database rollback, download authorization, deletion, orphan references/grace/pagination, and fresh adapter instances reading the same remote object after an ephemeral-root change.

These tests demonstrate persistence assumptions with a shared mock remote store; they are not proof that a live bucket or deployment is configured correctly. `/api/health/ready` reports scanner/storage **configuration**, not an end-to-end live scan or object probe. Do not mistake a 200 readiness response for hosted acceptance.

## Live hosted acceptance (operator-run, not executed here)

Use dedicated beta test accounts and disposable test files, preserving all existing users/data. Record timestamps, redacted request IDs, outcomes and cleanup counts in the release record.

- Confirm the merged App Platform spec passes validation, ClamAV has no public route, private DNS resolves from the web container, and port 3310 is reachable only through internal service networking. Check available memory while the signature database loads and reloads; no OOM/restart loops. Confirm clamd is ready, FreshClam reports current signatures and hourly checks, and `VERSION`/`PING` return a version/PONG over the private connection. Keep web credentials out of scanner logs.
- Upload a small PNG avatar, portfolio PDF, proof text, dispute attachment and support attachment as their authorized users. Check private quarantine → clean handling, correct metadata/hash/size and authorized byte-for-byte downloads. Test the 5 MiB avatar and 25 MiB per-file boundaries and existing aggregate limits through the hosted ingress; reject oversized and spoofed executable content.
- Upload the standard EICAR **test** string as a `.txt` file through a permitted evidence route. Expect 422, no inserted metadata and no clean object; unrelated existing files must remain readable. Do not use real malware.
- In a controlled maintenance window, make the web scanner host unreachable (without enabling local mode). Expect 503 on new uploads and no new clean metadata. Restore private DNS and verify recovery. Existing authorized downloads should still work while scanning is unavailable.
- Temporarily use a test credential without bucket access, or inject a storage outage in an isolated candidate service. Check 503 on writes/reads/deletes, no falsely successful upload, and cleanup retry after restoration. Do not revoke shared credentials used by other environments.
- Try direct unsigned bucket/object URLs (403), anonymous API downloads (401), another user's private avatar/portfolio, unrelated proof/dispute/support attachments and internal support messages (404), and quarantine keys (not available). Authorized downloads must contain `private, no-store` and no public redirect. Confirm anonymous public profile pages do not fetch upload bytes successfully.
- Replace and delete test avatar/portfolio media; verify old metadata/objects disappear. Simulate database insert failure in an isolated candidate, ensuring the new object is rolled back. If rollback deletion also fails, verify an old unreferenced object is collected later. Seed only a disposable old orphan under this beta prefix; dry-run then apply cleanup, proving referenced and recent objects remain. Restore temporary failure configuration.
- Record a test object's metadata/hash, redeploy/restart web and ClamAV, then download it again through the authorized app route. Confirm its hash is unchanged and no shared filesystem is required. Test a second web instance if horizontal scaling is intended.
- Recheck Resend email/webhooks, Google login and callback, session continuity, account preferences/saved searches/shortlist after restart, and community-beta identity-disabled behavior. Confirm database counts and existing records were not reset.

References: [App Platform app spec](https://docs.digitalocean.com/products/app-platform/reference/app-spec/), [internal routing](https://docs.digitalocean.com/products/app-platform/how-to/manage-internal-routing/), [Spaces S3 compatibility](https://docs.digitalocean.com/products/spaces/reference/s3-compatibility/), [official ClamAV image documentation](https://github.com/Cisco-Talos/clamav-docker/blob/main/clamav/README-alpine.md).
