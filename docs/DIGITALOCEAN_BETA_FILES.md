# Low-cost DigitalOcean community beta

The current beta runs **one 1 GB Next.js web service**, the existing database, and existing Resend/Google integrations. File uploads and identity verification are deliberately unavailable. No Spaces bucket, ClamAV service, worker or new paid database is required. Nothing in this change deploys infrastructure or changes existing database data.

The exact merge template is [`deploy/digitalocean/app.yaml`](../deploy/digitalocean/app.yaml): repository `Ajayfrizzy/klaveroq`, branch `staging`, `deploy_on_push: false`, one `apps-s-1vcpu-1gb` instance, HTTP port `8080`, public ingress to `web` only. Build and run commands:

```sh
npm ci --include=dev && npm run build
npm exec --workspace=@klaveroq/web -- next start --hostname 0.0.0.0 --port 8080
```

Preserved funded-upload deployment settings are in [`app-with-uploads.yaml`](../deploy/digitalocean/app-with-uploads.yaml) and [the Spaces/ClamAV guide](DIGITALOCEAN_UPLOADS.md). That infrastructure is not part of this low-cost deployment.

## Required runtime environment

Set these as **RUN_TIME** component variables. Reuse existing credentials; do not rotate secrets or create a new database merely to apply this template. Never put actual credentials in tracked files. The template contains placeholders, not deployable secret values.

| Variable | Value / purpose | Secret |
| --- | --- | --- |
| `NODE_ENV` | `production` | No |
| `DEPLOYMENT_STAGE` | `community_beta` | No |
| `IDENTITY_PROVIDER` | `disabled` | No |
| `IDENTITY_SANDBOX_ENABLED` | `0` | No |
| `FILE_UPLOADS_ENABLED` | **`false`**, exact lowercase value | No |
| `DATABASE_URL` | **Existing beta database connection**, preserving SSL/pooler requirements | Yes |
| `APP_URL` | Existing public HTTPS origin, no path/query/trailing slash | No |
| `SESSION_SECRET` | Existing random secret, at least 32 characters | Yes |
| `MFA_ENCRYPTION_KEY` | Existing base64-encoded 32-byte key; retain for existing MFA users | Yes |
| `EMAIL_PROVIDER` | `resend` | No |
| `EMAIL_FROM` | Existing sender on a Resend-verified domain | No |
| `RESEND_API_KEY` | Existing Resend key | Yes |
| `RESEND_WEBHOOK_SECRET` | Existing signing secret beginning `whsec_` | Yes |
| `GOOGLE_CLIENT_ID` | Existing OAuth client ID; required to retain Google sign-in | No |
| `GOOGLE_CLIENT_SECRET` | Matching OAuth secret | Yes |
| `CRON_SECRET` | Existing random secret, at least 32 characters, shared only with the trusted scheduler | Yes |

Optional settings to preserve when configured:

| Variable | Default / purpose | Secret |
| --- | --- | --- |
| `SESSION_COOKIE_NAME` | `klaveroq_session`; retain the existing value for continuity | No |
| `SESSION_TTL_DAYS` | `30` | No |
| `CKB_NETWORK` | `testnet`; does not enable funding/settlement | No |
| `ERROR_MONITORING_WEBHOOK_URL` | Optional existing monitoring receiver | Treat as secret if it includes a credential |
| `ERROR_MONITORING_TOKEN` | Optional monitoring authorization | Yes |

Do not set `E2E_TEST_MODE`, `AUTH_EXPOSE_LOCAL_TOKENS` or `SANDBOX_SECRET` on the hosted beta. `FILE_STORAGE_BACKEND`, `FILE_STORAGE_ROOT`, `FILE_SCANNER`, `CLAMAV_*`, and `SPACES_*` can be omitted. Do not copy the development `filesystem` or `local` scanner settings into App Platform. If a valid Spaces backend already serves historical files, its credentials may be retained for authorized downloads, while uploads remain disabled; no new bucket is required by this release.

All five upload APIs return **503 `FILE_UPLOADS_DISABLED`** before buffering multipart bytes or using storage/database providers. The shared storage entry point also checks the switch. This covers avatars, portfolio media, proof attachments, dispute attachments and support attachments. The interface removes media upload controls or disables file inputs/buttons and explains that uploads will be available later. The switch is read at request time and passed as a boolean to client components; it does not need a public environment variable or a secret-bearing client bundle.

Text profile editing/publishing, text/link portfolio entries, marketplace discovery, listings, proposals, messages, support tickets/replies, supported agreement drafts and text evidence remain available. The dispute evidence endpoint accepts text-only **JSON** (`{"note":"..."}`); multipart requests are unavailable during this beta even if they contain only a note. The application sends JSON when no files are attached. Existing funding-dependent stages remain locked; disabling uploads does not unlock funding, acceptance requiring reconciled funding, settlement, payouts, refunds or claims of secured balances.

When the exact five-variable beta combination above is present, readiness may omit Spaces and ClamAV, reporting `fileUploads: disabled` and both file dependencies as `not_required_uploads_disabled`. All existing HTTPS/database/email/security checks remain. An enabled or unset upload switch still requires secure storage and scanning in hosted deployments. Invalid switch values disable uploads and fail readiness. Full production still requires persistent private storage, ClamAV and a real registered identity provider even if uploads are disabled. The current repository has no real production identity adapter, so this release is not full-production-ready.

## Apply later, after review

1. Export the existing App Platform spec to a secure location outside Git. Merge the single-service template, preserving the current app name/region, domain, TLS routing, existing encrypted environment values and `DATABASE_URL`. Keep the actual web component name consistent with ingress if it is not `web`.
2. The selected runtime plan is `apps-s-1vcpu-1gb`, count `1`; verify regional availability and current pricing. Keep the app region near the existing database. Do not add a managed database, Spaces bucket, ClamAV component or paid worker for this beta. If those components already exist, any decommissioning is a separate reviewed operation—never delete their data automatically.
3. Fill placeholder settings using the existing deployment secrets. Preserve Google callback `APP_URL/api/auth/google/callback`, Resend sender/webhook `APP_URL/api/webhooks/resend`, session/MFA secrets, HTTPS and existing notification settings. Keep auto-deploy disabled. Validate the merged candidate with `doctl apps spec validate /secure/path/merged-app.yaml` before a separately approved deployment.
4. There is **no new migration**. Do not reset, truncate, seed, recreate or drop any beta database. If the database is behind existing migrations, review and back up before separately applying the existing forward migration process; never use test reset scripts on beta.
5. Check `/api/health/live` and `/api/health/ready`, then perform the acceptance checks below. Readiness confirms configuration and database connectivity, not live Resend/Google delivery.

## Existing files and data

Changing the switch performs no SQL, file deletion or metadata rewrite. Storage keys, hashes, scan status, profile/portfolio pointers and existing file metadata remain untouched. Account preferences, saved searches and shortlists remain PostgreSQL-backed.

Files stored on a prior local filesystem are **not durable or shared on App Platform**. Metadata alone cannot reconstruct them, and a redeployment can discard the old container's bytes. Back up any recoverable existing filesystem uploads before redeploying. Preserve those backups and metadata until funded persistent storage is available. In this low-cost beta, authorized requests for such files may return `FILE_STORAGE_UNAVAILABLE` (503) or, with a configured backend missing that object, `FILE_NOT_AVAILABLE` (404). Do not label the metadata deleted, substitute a different file, or create new empty files to conceal missing content.

Downloads retain their existing authorization checks; the upload switch does not make existing content public. Do not run orphan cleanup or an object-expiration policy during this no-upload rollout/backup period. Existing explicit owner-authorized deletion endpoints are not automatically invoked by disabling uploads. Avatar/portfolio upload/removal controls are hidden while uploads are disabled; text portfolio management remains supported.

## Scheduling without another App Platform service

Keep both authenticated endpoints:

- `POST /api/internal/notifications/retry`: retry pending outbox deliveries; recommended every minute where supported.
- `POST /api/internal/retention/purge`: run the existing short-lived retention policy daily. This maintains expired auth records and old notification bodies; it does not reset users, agreements, file metadata or preferences.

Use a trusted external scheduler that supports secret **Authorization headers**, or the included opt-in [GitHub Actions workflow](../.github/workflows/beta-maintenance.yml). The workflow uses no npm install or App Platform worker. Configure repository variable `BETA_APP_URL`, encrypted Actions secret `BETA_CRON_SECRET` matching the app's `CRON_SECRET`, and `BETA_MAINTENANCE_ENABLED=true` only after operator approval. The workflow remains dormant without that variable. Manual dispatch offers `notifications` and `retention` tasks.

GitHub scheduled workflows run only when present on the repository's **default branch**. Leaving this work on `staging` does not activate a schedule. An operator must arrange the workflow on the default branch or choose an external scheduler later. The workflow checks out the reviewed `staging` code, retries notifications every **five minutes** (GitHub's minimum interval), and runs retention at **03:17 UTC** daily. Scheduled Actions can be delayed and consume plan minutes; they are not a one-minute SLA or guaranteed free unlimited service. Enable only one scheduler for each task and monitor failures/outbox backlog. If one-minute delivery retries are essential, use an existing trusted cron host or an external scheduler with header secrets and suitable free-plan limits.

For a trusted cron host, inject `APP_URL` and `CRON_SECRET` from its secret store into the process environment, then run:

```sh
node scripts/run-beta-maintenance.mjs notifications
node scripts/run-beta-maintenance.mjs retention
```

The script only POSTs to the two fixed endpoints, requires HTTPS, refuses redirects, and logs task/status only. No secret is accepted in a URL or command-line argument. Do not use `curl -v`, query-string tokens, `set -x`, public ping URLs, or response-body logging with scheduler credentials. Review the existing retention policy before enabling its schedule; the workflow is not run as part of this implementation.

## Resource limits and acceptance

A 1 GB instance is a small-community starting point, **not a proven concurrency capacity**. File processing and ClamAV are absent, but Next.js SSR, database pools and native Argon2 authentication still consume memory. Each password hash uses about **64 MiB** plus overhead; concurrent sign-ins/registrations can exhaust 1 GB. Keep password hashing/security settings intact. Monitor RSS, restart/OOM events, p95 latency, database connections (existing production pool maximum 10 per process) and outbox backlog. Invite members gradually; if memory repeatedly exceeds roughly 80% or restarts occur, reduce traffic and budget for a larger instance before expanding. Do not use a large V8 heap limit that consumes all container RAM—native Argon2 and runtime buffers also need headroom.

Build memory is separate from runtime capacity. The production build passes locally, but that does not prove the App Platform builder or 1 GB runtime under load. Root layout reads the upload switch at request time, so rendered pages reflect deployment runtime settings rather than a build-time value. There is only one web instance and no autoscaling/failover in this budget template.

Before inviting members, check:

- Ready/live routes succeed with the documented beta configuration and no upload-provider settings.
- Registration, password/Google sign-in, email verification, Resend webhook and one retry-job run work with existing accounts/settings.
- Every upload API rejects with `FILE_UPLOADS_DISABLED`; controls cannot choose/send files. Profile edits, publication, text portfolios, support messages, listing/proposal/message/award-to-draft flows and account preferences still work.
- Identity remains unavailable; no funded balance, payout or settlement claim is created by the beta UI.
- Existing metadata and account records survive the deployment, including historical local-file records even if their bytes are unavailable.
- Redeploy and recheck sessions, preferences, saved searches and shortlists. Monitor memory during a small, controlled sign-in burst.

Automated evidence and outstanding hosted checks are recorded in [the functional audit](FUNCTIONAL_AUDIT.md) and [release checklist](RELEASE_CHECKLIST.md). No live deployment or paid service setup was performed.
