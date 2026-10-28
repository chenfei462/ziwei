# ADR-0002: Security configuration fails closed

Status: accepted

Session, operations, webhook, and production encryption secrets are required configuration. Missing or weak values reject startup/readiness and never fall back to source-controlled literals or unsigned client identity.
