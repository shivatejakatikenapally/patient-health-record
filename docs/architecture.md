# Phase 0 architecture

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

## Phase 0 limits

Role selection is scaffolding, not identity verification. Phase 0 does not verify patient identity, verify provider credentials, create clinical records, or grant patient-data access. It must not be represented as production clinical software. No real patient data should be entered until a security review and appropriate operational controls are completed.

## Deployment choices

- Web: Vercel project rooted at `apps/web`
- API: Render web service rooted at `apps/api`
- Database and object storage: Supabase
- Redis: Upstash
- Database schema: Alembic migrations run before the API starts on the initial demo-tier deployment
- API readiness: hosted PostgreSQL query, Redis ping, and required storage configuration
