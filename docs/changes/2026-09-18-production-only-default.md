---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-18
---

# 2026-09-18: Production-only default deployment

## Summary

Removed required branch previews from the boilerplate. The maintained topology
now consists of isolated local development and one production environment.

## Motivation

Preview-specific Worker configuration, scripts, D1 resources, and evidence made
initial setup harder while remaining optional for the expected users. Cloudflare
Workers Builds can add non-production branch builds later when a project needs
remote review environments.

## Behavior and configuration changes

- Removed `preview` from the runtime environment contract and smoke CLI.
- Disabled Preview URLs and removed preview build, migration, upload, and dry-run
  commands.
- Changed GitHub CI to package the production configuration.
- Kept optional preview setup as an operator recipe rather than a default path.

## Migrations and environment changes

Local D1 is labeled `tanbase-core-local` and remains isolated under Wrangler
local persistence. Production continues to target `tanbase-core-production`.
No SQL migration changed and no remote data operation was run.

Cloudflare operators must disable non-production branch builds and Preview URLs.
The production database ID remains unresolved pending access to the owning
account.

## Validation evidence

Local evidence:

- A fresh temporary D1 store applied the generated migration successfully; all
  eight statements completed.
- Running the seed twice left exactly one local project and one local task.
- `pnpm verify` passed formatting, lint, docs, migration checks, types, 19
  Workers-runtime tests, boundary checks, and the production build.
- `pnpm cf:dry-run:production` passed with `DB` bound to
  `tanbase-core-production` and `APP_ENV=production`.
- Regenerating Worker types left SHA-256
  `9dba85b1e5b5dc99280db102cf0bddcf6b7198c9661953042d8eb2a1c4c97c9f`
  unchanged.
- `pnpm smoke -- --url http://localhost:3005 --environment local` passed the
  database-aware health and existing SEO/discovery checks.
- An active-source search found no required preview environment, script, D1,
  smoke, or CI workflow reference.

## Deployment state

| Target     | Commit                          | URL                                | Date       | Result                                                  |
| ---------- | ------------------------------- | ---------------------------------- | ---------- | ------------------------------------------------------- |
| Local      | Working tree based on `e531853` | `http://localhost:3005`            | 2026-09-18 | Verify, fresh D1, type drift, dry run, and smoke passed |
| Production | —                               | `https://tanbase-core.tanfust.com` | 2026-09-18 | Topology change and D1 work are not deployed            |

## Rollback notes

Restore ADR-0004's preview environment, scripts, CI dry run, and separate D1
resource together. Do not connect a restored preview to production data.

## Remaining work

- Disable non-production branch builds and Preview URLs in the owning account.
- Create and bind `tanbase-core-production`, migrate, deploy, and smoke the same
  verified commit.
- Implement the email module after the production D1 rollout passes.
