# PS3 Patient-Held Consent-Driven Health Record

Team NSS · VNRVJIET · VJH 2k26

Mobile-first, cloud-hosted foundation for a patient-held longitudinal health record. A patient reference ID identifies a record; only explicit, purpose- and time-scoped consent authorizes access.

## Phase 0 status

The monorepo scaffold and role-based authentication foundation are prepared. Live deployment is not configured yet because hosted-service credentials and account/project access are not present in this workspace. Phase 0 is not complete until the deployed web app and API can create and authenticate users against hosted PostgreSQL.

## Cloud services selected

- Supabase PostgreSQL and private Storage
- Upstash Redis
- Vercel for `apps/web`
- Render for `apps/api`

Application processes are designed to use these hosted services. Local Docker files are reserved for development without real patient data. No SQLite or local-file persistence is used.

## Monorepo

- `apps/web`: Next.js, React, TypeScript, Tailwind CSS
- `apps/api`: FastAPI, Pydantic, SQLAlchemy, Alembic
- `packages/shared-types`: shared API role definitions
- `infra`: migration and local-development scaffolding
- `docs/architecture.md`: trust boundaries and Phase 0 deployment setup

## Configuration

Copy `apps/api/.env.example` to a private deployment secret store and fill in the hosted values. Configure the same API origin in Vercel as `NEXT_PUBLIC_API_BASE_URL`. Never commit secrets. The API refuses to start without a non-development signing key and hosted PostgreSQL, Redis, and Supabase Storage configuration.

## Phase sequence

Only Phase 0 is in scope until its live acceptance criteria are met. Later phases are listed in the project brief and will be implemented in order after confirmation.
