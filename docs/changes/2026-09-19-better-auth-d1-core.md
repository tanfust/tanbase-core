---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-19
---

# 2026-09-19: Better Auth D1 core

## Summary

Added the server-only Better Auth core on D1: email/password accounts,
verification, password reset, sessions, protected-route plumbing, and
idempotent default-project provisioning.

## Motivation

The app needs an authoritative identity and ownership boundary before the task
board or authentication UI can safely expose user data.

## Behavior and configuration changes

- Better Auth is created per request through the Drizzle D1 adapter.
- `/api/auth/$` handles GET and POST auth requests.
- Verification and reset callbacks use the Cloudflare email module and Worker
  `waitUntil()`.
- `_app` checks the session before loading and redirects unauthenticated users
  to `/login` with the original URL.
- The first session idempotently provisions one `My Project` record.
- D1 remains the session source of truth; ADR-0006 rejects an unsafe KV
  secondary-storage emulation.

## Migrations and environment changes

- Added the `user`, `session`, `account`, and `verification` tables in additive
  migration `0001_lethal_blink.sql`.
- Added pinned `better-auth@1.7.5`.
- Added non-secret `BETTER_AUTH_URL` variables for local and production and
  regenerated Worker types.
- `BETTER_AUTH_SECRET` must be set in ignored `.dev.vars` locally and as a
  Cloudflare Worker secret in production; it is never committed.

## Validation evidence

- `pnpm test -- src/modules/auth/auth.server.test.ts` — 30 Workers-runtime tests
  passed, including the complete auth-core journey and existing suites.
- `pnpm db:migrate:local` — applied `0001_lethal_blink.sql`; 10 commands
  completed successfully.
- `pnpm verify` — formatting, lint, docs, migration history, types, 30 runtime
  tests, server-only boundaries, and the production build passed.
- `pnpm cf:dry-run:production` — packaged 36 Worker modules and reported the
  production D1, Email, `APP_ENV`, `BETTER_AUTH_URL`, and `EMAIL_FROM` bindings.
- `pnpm cf:typegen` — identical SHA-1 before and after regeneration
  (`9556744b25ba9c09d8964048e1cc8eefed1063ea`).
- `pnpm smoke -- --url http://localhost:3005 --environment local` — health,
  SSR, and discovery checks passed; `/app` returned `307` to
  `/login?redirect=%2Fapp` when unauthenticated.

## Deployment state

| Target     | Commit                          | URL                                | Date       | Result                                        |
| ---------- | ------------------------------- | ---------------------------------- | ---------- | --------------------------------------------- |
| Local      | Working tree based on `3ae705f` | `http://localhost:3005`            | 2026-09-19 | Verify, dry run, auth tests, and smoke passed |
| Production | —                               | `https://tanbase-core.tanfust.com` | 2026-09-19 | Not migrated, deployed, or verified           |

## Rollback notes

Roll back the Worker code before considering database cleanup. The migration is
additive and can remain safely unused; dropping auth tables would be a separate
destructive operation and must not be part of an emergency code rollback.

## Remaining work

- Complete the auth UI and consume the preserved redirect after sign-in.
- Enable and verify production transactional email delivery.
- Add Turnstile and distributed auth rate limiting in F-006.
- Set the production secret, apply the migration, deploy, and run the complete
  browser journey before marking F-005 done.
