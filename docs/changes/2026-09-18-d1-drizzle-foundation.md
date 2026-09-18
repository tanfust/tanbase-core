---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-18
---

# 2026-09-18: D1 and Drizzle foundation

## Summary

Added the first data-backed slice: separate preview and production D1
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
- Preview/local targets `tanbase-core-preview`; production targets
  `tanbase-core-production`. Remote database IDs are intentionally unresolved
  until the account that owns the live Worker is accessible.
- Added additive migration
  `drizzle/migrations/0000_many_sharon_carter.sql` and configured Wrangler's
  nested migration pattern.
- Added local-only idempotent seed data. It must never be applied remotely.
- Added pinned `drizzle-orm`, `drizzle-kit`, and
  `@cloudflare/vitest-plugin` dependencies.

## Validation evidence

Local evidence:

- `pnpm db:generate` — generated the reviewed project/task migration.
- `pnpm cf:typegen` — generated `Env.DB: D1Database`; Wrangler reported a
  sandbox-only log-file warning but completed successfully.
- `pnpm typecheck` — passed.
- `pnpm test` — 3 files and 21 Workers-runtime tests passed.
- `pnpm db:migrate:local` — 8 commands applied successfully.
- `pnpm db:seed:local` twice, followed by a count query — remained exactly one
  local project and one local task.
- `pnpm db:check` — migration history is valid.
- `pnpm verify` — formatting, lint, docs, types, 21 Workers-runtime tests,
  boundary checks, and the production build passed.
- `pnpm cf:dry-run:preview` and `pnpm cf:dry-run:production` — passed and exposed
  the correct environment-specific D1 binding names.
- `pnpm smoke -- --url http://localhost:3005 --environment local` — passed the
  database-aware health and existing SEO/discovery checks.
- Regenerating Worker types left the SHA-256 unchanged at
  `b3f0e8c5f6d828d2c362e014d28946a54ad94e9a3af1af08fc7c8130a88dc020`.

Wrangler could not write optional debug logs outside the workspace sandbox, but
type generation and both dry runs completed with exit code 0. No preview or
production D1 evidence exists yet.

## Deployment state

| Target     | Commit                                 | URL                                | Date       | Result                                                           |
| ---------- | -------------------------------------- | ---------------------------------- | ---------- | ---------------------------------------------------------------- |
| Local      | Working tree based on `d6a81bc32d0d79` | `http://localhost:3005`            | 2026-09-18 | Migration, seed, verify, smoke, and both dry runs passed         |
| Preview    | —                                      | —                                  | 2026-09-18 | Blocked: owning Cloudflare account and D1 IDs are not accessible |
| Production | —                                      | `https://tanbase-core.tanfust.com` | 2026-09-18 | Existing Worker healthy; D1 change not deployed                  |

## Rollback notes

Before remote rollout, revert the code, generated migration, and binding
configuration together. After remote rollout, first roll back the Worker code;
the additive tables and indexes are safe to leave in place. Remove them only in
a separately verified contract migration after no deployed code depends on
them.

## Remaining work

- Access the Cloudflare account that owns `tanbase-core`, create the two D1
  databases, and commit their exact IDs.
- Reconcile F-001 and F-002 by uploading and smoking an unpromoted same-Worker
  preview before applying the D1 migration remotely.
- Apply the migration and smoke preview, then migrate and deploy the same
  verified commit to production with separate evidence.
- Implement the email module next, then Better Auth core, auth UI, and
  Turnstile/rate limits.
- Add attachment schema in F-010 and AI usage schema in F-013.
