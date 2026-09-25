---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-25
---

# 2026-09-25: Post-deploy smoke waits for the deployed version

## Summary

`GET /api/health` now reports the running Worker version, and the post-deploy
smoke waits until the edge serves the version Wrangler just deployed before it
asserts anything.

## Motivation

Workers Build `4bbe27e4` deployed F-011 as version `d7d9401f` at 22:06:10 UTC,
then failed. All three post-deploy smoke attempts, at 22:06:16, 22:06:31, and
22:06:46 UTC, reached the Singapore (`SIN`) location, which Worker logs show
still serving version `27b14b56` and then `3240ddca`. Those versions have no
`realtime` health check, so the contract assertion failed. Production was
healthy on `d7d9401f` minutes later.

Before this change, smoke could not tell which version answered. A deployment
that leaves the smoke contract unchanged could pass against the old version,
and one that changes it could fail during normal propagation.

## Behavior and configuration changes

- Every Wrangler configuration binds `version_metadata` as
  `CF_VERSION_METADATA`. The health response adds `version`: that binding's
  ID, or `null` when an installation drops the binding.
- `scripts/smoke.mjs` accepts `--expect-version <id,...>`. While the health
  response reports any other version it prints the served version and exits
  with status `3` before running assertions. It also asserts that `version` is
  a non-empty string wherever the binding is configured.
- `scripts/smoke-after-deploy.mjs` reads the active deployment's versions with
  `wrangler deployments status --json`, which resolves the same configuration
  as `wrangler deploy`. It reruns smoke every 5 seconds while it exits with `3`,
  for up to 180 seconds, then retries other failures up to three times, 15
  seconds apart, as before.
- [ADR-0009](../decisions/0009-public-health-endpoint.md) is amended: the
  version ID is exposed because it is not a secret and grants no access.

## Migrations and environment changes

No migration, variable, or secret. The binding needs no resource. Worker types
were regenerated.

## Validation evidence

Local:

- `pnpm verify` — passed: formatting, lint, 45 maintained documents, Drizzle
  history, types, 74 Workers-runtime tests, one component test, installer
  tests, boundaries, and the production build.
- `pnpm cf:dry-run:production` — passed with `env.CF_VERSION_METADATA`
  (Worker Version Metadata) next to `env.BOARD`.
- `src/lib/health.test.ts` (6 tests) — passed. The contract test expects the Workers-runtime
  version ID; the disabled and error cases expect `null`.
- `vite dev`, then `pnpm smoke -- --url http://localhost:3111 --environment
local` — passed; health reported a version ID.
- `node scripts/smoke.mjs --environment production --expect-version
d7d9401f-…` against production before this change — printed that the
  origin serves version `unknown` and exited with `3`, the path the next
  deployment takes until the edge serves it.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result                            |
| ---------- | ------------------------------- | -------------------------- | ---------- | --------------------------------- |
| Local      | Working tree based on `eb0e127` | `http://localhost:3111`    | 2026-09-25 | Tests, local smoke, and wait path |
| Production | —                               | `https://core.tanbase.dev` | —          | Not deployed                      |

## Rollback notes

Revert the health module, scripts, and configuration together: the previous
smoke asserts the exact health contract and rejects the `version` field. After
a Worker rollback to a version from before this change, this smoke reports
status `3` until its timeout.

## Remaining work

- Record the first deployment that exercises the wait.
