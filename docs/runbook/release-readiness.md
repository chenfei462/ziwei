# Release readiness runbook

1. Copy `.env.example` into the deployment secret manager and replace every placeholder.
2. Run `npm ci`, `npm run typecheck`, `npm test`, `npx prisma validate`, and `npm run build`.
3. Confirm `DATABASE_URL`, session/admin tokens, webhook secrets, Redis, observability, and backup health checks are ready.
4. Exercise negative checks: missing secrets, forged cookies, forged ops headers, and invalid webhook signatures must fail closed.
5. Roll out gradually and retain the previous image plus migration backup for rollback.
