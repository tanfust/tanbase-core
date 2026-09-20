---
status: draft
audience: contributors, maintainers, agents
last_verified: 2026-09-20
---

# 2026-09-19: Resumable guided setup

## Summary

Added the repository-owned guided installer for isolated local setup and the
essential production Cloudflare path. It provisions D1, configures Better Auth
without persisting its production secret, deploys, reconciles canonical URLs,
and verifies the result.

## Motivation

The template needed a safe one-command path for a buyer starting from a fresh
clone. Manual account, database, migration, secret, configuration, and smoke
steps were too easy to perform against the wrong target or in the wrong order.

## Behavior and configuration changes

- Added `pnpm run setup`, `--local-only`, `--dry-run`, `--yes`, account/name
  selection, explicit existing-resource reuse, and resumable non-secret state.
- Added pure setup helpers and Node test coverage for parsing, planning, JSONC
  personalization, collision selection, URL handling, secrets, and state.
- Extended smoke coverage with the unauthenticated protected-route redirect.
- Made the native Email Service binding opt-in so optional onboarding cannot
  block a fresh account; safe metadata logging remains the default.
- Added the active installation guide and ADR-0007.

## Migrations and environment changes

No new database migration is required. The setup script applies all existing
local and production migrations with Wrangler. It generates ignored local
`BETTER_AUTH_SECRET`, uploads a generated production secret from a temporary
permission-restricted file only when missing, and stores no secret in setup
state. Existing installations must add the `EMAIL` binding explicitly when
enabling Cloudflare Email Service.

## Validation evidence

- `pnpm test:setup` — passed, 15 Node tests.
- `pnpm run setup --dry-run` — passed without local or remote mutation.
- `pnpm run setup --local-only --yes` — passed; local migrations, seed,
  deterministic type generation, and the complete verification gate passed.
- `pnpm cf:typegen` — passed with ignored local secrets excluded through
  `scripts/typegen.env`.
- `pnpm verify` — passed: formatting, lint, docs, Drizzle history, typecheck, 30
  Workers-runtime tests, 15 setup tests, import/database boundaries, and build.
- `pnpm cf:dry-run:production` — passed; packaged D1 and non-secret production
  variables without an Email binding.
- `pnpm smoke -- --url http://localhost:3005 --environment local` — passed,
  including database health, SSR/SEO discovery, and the protected-route redirect.

No production setup or deployment was run as part of this implementation.

## Deployment state

| Target     | Commit | URL | Date       | Result                                 |
| ---------- | ------ | --- | ---------- | -------------------------------------- |
| Local      | —      | —   | 2026-09-20 | Full local-only setup path passed      |
| Production | —      | —   | 2026-09-20 | Not deployed; external setup test open |

## Rollback notes

Revert the installer, documentation, optional binding change, and package
scripts. `.tanbase/` and `.dev.vars` are ignored and may be retained or removed
locally. The installer never deletes Cloudflare resources; any resources it
created must be reviewed and removed manually only when the operator intends it.

## Remaining work

- Run the complete path from a fresh external account and record elapsed time.
- Add and validate the Deploy to Cloudflare button without making previews part
  of the default topology.
- Enable and verify Email Service separately on an eligible account and domain.
