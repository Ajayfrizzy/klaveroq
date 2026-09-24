# Klaveroq

Klaveroq is a trusted work marketplace where clients discover talent, professionals find opportunities, and both sides structure milestone-based work with verifiable delivery and protected payments.

**Work with trust. Deliver with proof.**

Trusted work marketplace for talent discovery, verifiable milestones, and protected payments.

## Prerequisites

- Node.js 22 or newer
- npm
- Docker, for the local PostgreSQL database

## Local setup

```bash
npm install
cp .env.example apps/web/.env
docker compose up -d postgres
npm run db:migrate
npm run dev
```

The web application runs at `http://127.0.0.1:3000` by default. Use that exact origin for browser
access, `APP_URL`, and the Google OAuth redirect URI; do not mix it with `localhost`.

Register fresh client and worker accounts at `/register`. The normal setup does not seed the six
demonstration accounts. Run the guarded seed command only when demonstration data is explicitly
needed.

## Useful commands

```bash
npm run dev          # Start the Next.js development server
npm run build        # Create a production build
npm run lint         # Run ESLint
npm run typecheck    # Check TypeScript
npm test             # Run the test suite
npm run test:integration --workspace=@klaveroq/web  # Real API/PostgreSQL transactions
npm run test:e2e --workspace=@klaveroq/web          # Chromium desktop and mobile journeys
npm run db:generate  # Generate a Drizzle migration
npm run db:migrate   # Apply database migrations
KLAVEROQ_ALLOW_LOCAL_SEED=1 npm run db:seed:demo  # Explicitly create local-only demo data
```

## Repository map

```text
apps/web/src/
├── app/                 Next.js pages and API route entry points
├── components/
│   ├── layout/          Application shell and page-level layout
│   └── ui/              Reusable, feature-independent UI
├── features/            UI, fixtures, validation, and services by product feature
├── server/              Shared server infrastructure and compatibility exports
├── styles/              Global styles and design tokens
packages/domain/src/     Framework-independent domain types and rules
apps/web/drizzle/        Generated database migrations
docs/                    Product and architecture documentation
scripts/                 Repository maintenance and document-generation scripts
```

See [the source organization guide](apps/web/src/README.md) before adding a new feature.

## Environment

Copy `.env.example` to `apps/web/.env`. The example contains safe local defaults for PostgreSQL, session configuration, testnet CKB, sandbox identity verification, and local file storage. Google OAuth values are optional for local development.

Do not commit `apps/web/.env` or other files containing credentials.

### Data and preview fixtures

Hosted environments always use `DATABASE_URL`. If the database is missing or unavailable, the
request fails visibly instead of falling back to sample records. Fixture modules are retained only
for isolated local tests and are not imported by customer-facing routes.

`KLAVEROQ_PREVIEW_MODE=1` is accepted only outside production and CI. The seed command has a second
guard: it requires `KLAVEROQ_ALLOW_LOCAL_SEED=1` and a loopback `DATABASE_URL`. It refuses production
or remote databases.

The local PostgreSQL database and volume now use Klaveroq identifiers. Developers with the old
development volume can reset it with `docker compose down -v` before running `docker compose up -d`.

### Isolated browser and integration tests

The test harness never uses `apps/web/.env`'s normal database. Start its temporary PostgreSQL
service, then run either suite:

```bash
docker compose up -d postgres-test
npm run test:integration --workspace=@klaveroq/web
npm run test:e2e --workspace=@klaveroq/web
```

The service is `klaveroq_test` on `127.0.0.1:55434` and stores data in container `tmpfs`. Before a
suite, `scripts/reset-test-db.mjs` refuses non-loopback or non-test database names, resets only that
database, and reapplies migrations. Tests create uniquely named accounts and do not run the demo
seeder. Playwright starts the application at `http://127.0.0.1:3199` with separate Next.js build
artifacts, so it can coexist with a development server.

## Demo accounts

Password: `KlaveroqDemo!2026`

- `client@klaveroq.local`
- `worker@klaveroq.local`
- `designer@klaveroq.local`
- `writer@klaveroq.local`
- `admin@klaveroq.local`
- `support@klaveroq.local`

These accounts exist only after the explicitly guarded local seed command. Never configure them in
a hosted database. See [the seeded-data cleanup procedure](SEEDED_DATA_CLEANUP.md) before
removing any suspected demo records from an existing environment.

## Google OAuth

Set `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `DATABASE_URL` in the runtime
environment. For local development, register
`http://127.0.0.1:3000/api/auth/google/callback` in Google Cloud. For the DigitalOcean beta, set
`APP_URL=https://beta.klaveroq.com` and register the exact callback
`https://beta.klaveroq.com/api/auth/google/callback`.

The client secret is server-only. Restart the application after changing environment variables.
Google sign-in cannot be considered end-to-end verified until real credentials and a browser login
have been tested in that environment.

## Code organization rules

- Keep files under `app/` focused on routing, request parsing, and composing screens.
- Put code owned by one product area under `features/<feature>`.
- Put components in `components/ui` only when they are reusable across features.
- Keep database access and secrets out of client components.
- Colocate focused tests with the module they cover.
- Export shared domain types through `@klaveroq/domain`; do not import its internal files from the web app.
- Do not edit files under `drizzle/` manually. Generate migrations with `npm run db:generate`.

Marketplace assistance uses the server-side provider boundary in `features/ai`. Local development
defaults to the safe mock provider; generated job and proposal drafts are always editable and are
never published or submitted automatically. PactAgent remains the infrastructure boundary for
escrow, settlement, and proof-processing capabilities.
