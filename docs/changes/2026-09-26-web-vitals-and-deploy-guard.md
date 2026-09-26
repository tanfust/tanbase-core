---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-26
---

# 2026-09-26: Core Web Vitals in PostHog and a superseded-build deploy guard

## Summary

PostHog now records Core Web Vitals, and a Workers Build whose commit is no
longer the tip of `main` skips its deploy instead of replacing newer code.

## Motivation

PostHog recorded no web vitals: they were off, and its web-vitals code loads
from a CDN the CSP blocks. Cloudflare Web Analytics does record them for the
zone; an earlier check that found no beacon was wrong, corrected on
2026-09-26. Separately, PRs #26 and #27 merged 16 seconds apart and
the older build deployed last, serving code without #27 for eight minutes;
both post-deploy smokes passed because each checks only its own version.

## Behavior and configuration changes

- `src/components/analytics.tsx` bundles `posthog-js/dist/web-vitals` and sets
  `capture_performance` to web vitals without attribution and without network
  timing ([ADR-0010 amendment](../decisions/0010-privacy-first-analytics.md#amendment-2026-09-26-web-vitals)).
- `src/modules/analytics/privacy.ts` strips query strings and fragments from
  the `$current_url` and `navigationURL` inside each `$web_vitals_*_event`.
- `pnpm cf:deploy:production` ends with `scripts/deploy-if-current.mjs`, which
  runs `wrangler deploy` and the post-deploy smoke only when the Workers Build
  is for the current tip of `main`, read with `git ls-remote`. A superseded
  build logs the newer commit and exits successfully. Local runs and an
  unreadable tip always deploy.
- `pnpm test:scripts` runs the guard's tests and joins `pnpm verify`.

## Migrations and environment changes

None. The guard reads `WORKERS_CI`, `WORKERS_CI_BRANCH`, and
`WORKERS_CI_COMMIT_SHA`, which Workers Builds sets.

## Validation evidence

Local:

- `src/platform/analytics.test.ts` — 8 tests, including query strings inside
  web vitals metrics.
- `scripts/deploy-guard.test.mjs` — 6 tests: superseded, current, local and
  off-`main` builds, unknown commit or tip, and parsing `git ls-remote`.
- `scripts/deploy-if-current.mjs` with Workers Builds variables and `wrangler`
  removed from `PATH`: an older commit printed the skip message and exited 0
  against the real remote tip `023fb25`; the tip itself went on to run
  `wrangler deploy`.
- Headless Chromium against the dev server, with a fake key, an unresolvable
  host, and a `before_send` that dropped every event: without the bundled
  extension no event; with it a `$web_vitals` event with FCP, no
  attribution, and `?token=secret#frag` removed from every URL. PostHog drops
  events from headless user agents, so that run set
  `opt_out_useragent_filter`.
- `pnpm verify` — passed in a clean worktree without `.dev.vars`: 164 Worker,
  18 UI, 23 setup, and 6 script tests.
- `pnpm cf:dry-run:production` — passed.

Production:

- Workers Build `9c9ca53f` deployed merge `a2fe387` as version `86a32108` at
  21:47 UTC. `scripts/deploy-if-current.mjs` ran, found the build at the tip of
  `main` without a warning, so `git ls-remote` works in Workers Builds, and
  deployed. Post-deploy smoke passed on the first attempt.
- `pnpm smoke -- --environment production --expect-version 86a32108-2c91-4f12-8675-c90532d5b5cc`
  — passed at 21:50 UTC.
- The live page in Chrome, with every PostHog request intercepted and aborted
  so nothing reached the project: a `$pageview`, then 8 seconds later a
  `$web_vitals` event with FCP at 1,640 ms, no attribution, and
  `?token=secret#frag` removed from every URL; no CSP violations. Headless
  Chromium sends nothing, because PostHog treats its `HeadlessChrome` brand as
  a bot.
- The skip path has not run in production yet; no builds have overlapped.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------ |
| Local      | Working tree based on `023fb25` | `http://localhost:3000`    | 2026-09-26 | Passed |
| Production | `a2fe387` / version `86a32108`  | `https://core.tanbase.dev` | 2026-09-26 | Passed |

## Rollback notes

Revert the change. Without the guard, avoid merging two PRs close together,
and check `/api/health` against the newest build after each deploy.

## Remaining work

- Watch for the guard's skip message the next time two builds overlap.
