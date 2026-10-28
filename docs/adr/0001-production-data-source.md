# ADR-0001: PostgreSQL is the production source of truth

Status: accepted

Production writes and reads must use PostgreSQL through the repository boundary. The file store is limited to local development, tests, and explicitly configured migration tooling. A deployment without `DATABASE_URL` fails readiness rather than silently falling back.
