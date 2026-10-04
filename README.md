# PS3 Patient-Held Consent-Driven Health Record

Team NSS · VNRVJIET · VJH 2k26

Mobile-first, cloud-hosted foundation for a patient-held longitudinal health record. A patient reference ID identifies a record; only explicit, purpose- and time-scoped consent authorizes access.

## Phase status

Phase 0 is deployed on Vercel and Render and uses the hosted Supabase PostgreSQL, private Storage, and Render Key Value services. Phase 1 adds patient and provider profile management, patient-owned health-record CRUD, timeline views, private document upload/download/delete, and audit events for profile, record, and document actions. Providers can manage their own profile but do not have access to patient records in Phase 1.

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

## Phase 1 behavior and limits

- Patient reference IDs are random account identifiers. They do not prove a person's identity and do not grant access.
- Provider profiles are self-entered and remain marked pending; no licensing registry is integrated.
- Health records and private documents can only be accessed through patient-authenticated API routes in this phase.
- Uploaded PDFs and images are stored in the private Supabase Storage bucket. The API creates short-lived signed download links after checking ownership.
- Caregiver tools and provider access requests belong to later phases.
- Use synthetic demo information only until an appropriate security and privacy review is complete.

On deployment, Render runs Alembic migrations before starting the API. The Phase 1 migration adds profiles, records, documents, and append-only audit entries to the hosted PostgreSQL database.
