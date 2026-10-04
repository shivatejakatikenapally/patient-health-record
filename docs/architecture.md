# Phase 0 and Phase 1 architecture

## Trust boundaries

The Next.js application is a mobile-first presentation layer. It sends authentication requests to the FastAPI service and contains no business logic. FastAPI is the API boundary and owns authentication, authorization, input validation, database access, and audit-ready request context. PostgreSQL is the source of truth. Redis is a hosted cache/session dependency, never the source of consent truth. Supabase Storage is private object storage; future document access must use short-lived signed URLs.

The QR/reference ID is an identifier only. It must never contain health information or act as an access credential. Consent, records, provider access, and audit logging are separate services in later phases. A patient or helper flow must not allow a helper to authorize access for the patient.

## Phase 0 request flow

1. The browser submits a role, email, and password to FastAPI over HTTPS.
2. FastAPI validates the request and hashes the password using Argon2.
3. SQLAlchemy stores the account in hosted PostgreSQL.
4. Login verifies the stored password hash and issues a signed short-lived access token with the selected role.
5. `/auth/me` validates the token and reads the account from PostgreSQL.
6. Redis and private object storage are configured as hosted dependencies and checked by readiness diagnostics.

## Phase 1 behavior

Patient and provider profiles are owner-scoped. Patients can create and edit their own timeline records and documents. Every profile, record, and document read or write appends a metadata-only event to `audit_logs`. Providers can view and edit only their own profile; no provider route can read patient records in this phase. Patient uploads go to the private Supabase Storage bucket. The API checks the requesting patient's ownership before returning a five-minute signed download URL.

Reference IDs are unique account identifiers, not identity credentials. Provider verification stays pending until a real credential verification integration is added. All four Phase 1 tables and the audit log have row-level security enabled without public policies; the FastAPI backend enforces per-owner access using its private database connection.

## Phase 0 and Phase 1 limits

Role selection is scaffolding, not identity verification. The current version does not verify patient identity or provider credentials, and Phase 1 does not grant provider access to patient data. It must not be represented as production clinical software. Use synthetic data until a security review and appropriate operational controls are completed.

## Deployment choices

- Web: Vercel project rooted at `apps/web`
- API: Render web service rooted at `apps/api`
- Database and object storage: Supabase
- Redis: Upstash
- Database schema: Alembic migrations run before the API starts on the initial demo-tier deployment
- API readiness: hosted PostgreSQL query, Redis ping, and required storage configuration
