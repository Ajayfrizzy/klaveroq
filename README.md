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
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

The web application runs at `http://localhost:3000` by default.

## Useful commands

```bash
npm run dev          # Start the Next.js development server
npm run build        # Create a production build
npm run lint         # Run ESLint
npm run typecheck    # Check TypeScript
npm test             # Run the test suite
npm run db:generate  # Generate a Drizzle migration
npm run db:migrate   # Apply database migrations
npm run db:seed      # Create local demo data
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

### Vercel visual previews

When Vercel runs the app without `DATABASE_URL`, the public jobs, work-discovery, and talent
screens automatically use read-only sample data. This keeps visual review deployments navigable
without presenting preview actions as functional backend operations. Configure `DATABASE_URL` for
the full database-backed behavior.

Set `KLAVEROQ_PREVIEW_MODE=1` to exercise the same fallback locally, or set it to `0` to disable the
automatic fallback explicitly.

The local PostgreSQL database and volume now use Klaveroq identifiers. Developers with the old
development volume can reset it with `docker compose down -v` before running `docker compose up -d`.

## Demo accounts

Password: `KlaveroqDemo!2026`

- `client@klaveroq.local`
- `worker@klaveroq.local`
- `designer@klaveroq.local`
- `writer@klaveroq.local`
- `admin@klaveroq.local`
- `support@klaveroq.local`

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
