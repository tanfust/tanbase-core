---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-18
---

# 2026-09-18: D1 and Drizzle foundation

## Summary

Added the first data-backed slice: isolated local and production D1
configuration, Drizzle project and task schemas, Wrangler-managed migrations,
ownership-scoped repositories, runtime integration tests, and a database-aware
health check.

## Motivation

Authentication needs a verified data and ownership boundary. Establishing that
boundary before auth UI prevents user-scoping rules and environment separation
from being retrofitted after product flows depend on them.

## Behavior and configuration changes

- `GET /api/health` now performs `SELECT 1` through `env.DB`, includes
  `checks.database`, and returns a sanitized `503` when D1 is unavailable.
- Project and task IDs and timestamps are generated server-side. Database names
  are snake_case while TypeScript properties are camelCase.
- Composite foreign keys enforce project ownership, subtask scope, and cascade
  deletion. Task status is constrained to `todo`, `doing`, or `done`.
- Project and task repositories require `userId` first and return no record for
  cross-user reads.
- Vitest now runs inside the Workers runtime with isolated D1 storage and the
  real generated migration.

## Migrations and environment changes

- Added the `DB: D1Database` Worker binding.
- Local persistence uses `tanbase-core-local`; production targets
  `tanbase-core-production` at
  `3736933e-6d18-4dbb-aba1-ccd046861b2b`.
- Added additive migration
  `drizzle/migrations/0000_many_sharon_carter.sql` and configured Wrangler's
  nested migration pattern.
- Added local-only idempotent seed data. It must never be applied remotely.
- Added pinned `drizzle-orm`, `drizzle-kit`, and
  `@cloudflare/vitest-plugin` dependencies.

## Validation evidence

Local evidence:

- `pnpm db:generate` — generated the reviewed project/task migration.
- `pnpm cf:typegen` — generated `Env.DB: D1Database` with only `local` and
  `production` application environments.
- `pnpm typecheck` — passed.
- `pnpm test` — 3 files and 19 Workers-runtime tests passed.
- `pnpm db:migrate:local` — 8 commands applied successfully.
- `pnpm db:seed:local` twice, followed by a count query — remained exactly one
  local project and one local task.
- `pnpm db:check` — migration history is valid.
- `pnpm verify` — formatting, lint, docs, types, 19 Workers-runtime tests,
  boundary checks, and the production build passed.
- `pnpm cf:dry-run:production` — passed and exposed the production D1 binding.
- `pnpm smoke -- --url http://localhost:3005 --environment local` — passed the
  database-aware health and existing SEO/discovery checks.
- Regenerating Worker types left the SHA-256 unchanged at
  `9dba85b1e5b5dc99280db102cf0bddcf6b7198c9661953042d8eb2a1c4c97c9f`.

Production D1 evidence:

- `pnpm db:migrate:production` — applied
  `migrations/0000_many_sharon_carter.sql`; 8 commands succeeded.
- `wrangler d1 migrations list DB --env production --remote` — no migrations
  remain.
- A read-only `sqlite_schema` query confirmed the `project` and `task` tables on
  database `3736933e-6d18-4dbb-aba1-ccd046861b2b`.

## Deployment state

| Target        | Commit                          | URL / resource                         | Date       | Result                                                        |
| ------------- | ------------------------------- | -------------------------------------- | ---------- | ------------------------------------------------------------- |
| Local         | Working tree based on `e531853` | `http://localhost:3005`                | 2026-09-18 | Migration, seed, verify, smoke, and production dry run passed |
| Production D1 | `e531853`                       | `3736933e-6d18-4dbb-aba1-ccd046861b2b` | 2026-09-18 | Migration applied and project/task tables confirmed           |
| Production    | —                               | `https://tanbase-core.tanfust.com`     | 2026-09-18 | Existing Worker healthy; D1 binding not deployed              |

## Rollback notes

Before remote rollout, revert the code, generated migration, and binding
configuration together. After remote rollout, first roll back the Worker code;
the additive tables and indexes are safe to leave in place. Remove them only in
a separately verified contract migration after no deployed code depends on
them.

## Remaining work

- Deploy the verified D1 binding to production and record database-aware smoke
  evidence.
- Implement Better Auth core, auth UI, and Turnstile/rate limits.
- Add attachment schema in F-010 and AI usage schema in F-013.
