---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-26
---

# 2026-09-26: Serve the AI Catalog with its own media type

## Summary

`/.well-known/ai-catalog.json` and `/.well-known/ard.json` now answer with
`Content-Type: application/ai-catalog+json` instead of `application/json`.

## Motivation

The first production scan after
[agent discovery](2026-09-26-agent-discovery.md) passed the ARD check but
reported `correctMediaType: false`. The AI Catalog specification names
`application/ai-catalog+json`, and the earlier choice rested on the wrong
assumption that the check expected plain JSON.

## Behavior and configuration changes

- `src/modules/discovery/well-known.ts` serves both catalog names as
  `application/ai-catalog+json`. The body is unchanged.
- The discovery tests and the smoke suite expect the new type.

## Migrations and environment changes

None.

## Validation evidence

Local:

- `pnpm verify` — passed in a clean worktree without `.dev.vars`: 161 Worker
  tests and 18 UI tests.
- `pnpm smoke -- --url http://localhost:3000 --environment local` — passed
  against a dev server from the same worktree; both catalog paths answered
  `application/ai-catalog+json`.

Production:

- Workers Build `779bec50` deployed merge `023fb25` as version `6db1bd46` and
  its smoke passed, but the build for the older `d169717` finished 26 seconds
  later and replaced it. `wrangler versions deploy` promoted `6db1bd46` back at
  21:27 UTC.
- `pnpm smoke -- --environment production --expect-version 6db1bd46-cbae-48d1-859d-acb56e8b4861`
  — passed at 21:28 UTC.
- The readiness scan at 21:28 UTC stayed at level 5 and reported the ARD
  manifest as `application/ai-catalog+json` with `correctMediaType: true`.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------ |
| Local      | Working tree based on `9e695ab` | `http://localhost:3000`    | 2026-09-26 | Passed |
| Production | `023fb25` / version `6db1bd46`  | `https://core.tanbase.dev` | 2026-09-26 | Passed |

## Rollback notes

Revert the change; consumers accept either JSON type.

## Remaining work

- None.
