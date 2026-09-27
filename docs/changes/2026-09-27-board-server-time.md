---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-27
---

# 2026-09-27: One Better Auth instance per isolate, one session lookup per request

## Summary

The board rendered in about 400 ms of Worker time, putting its time to first
byte over the 400 ms budget. It now builds Better Auth once per isolate and
looks up the session once per request. The CI Lighthouse checks now alarm
below 90, and the 95 budget is measured with PageSpeed Insights.

## Motivation

Ten signed-in board loads on version `7df1cb2d` took a p75 of 407 ms of
Worker wall time and 129 ms of CPU. That derives to a board TTFB of about
540 ms from Tunis and 620 ms from US East
([Performance](../PERFORMANCE.md)). One render made about 12 sequential D1
queries:

- The `_app` layout, `getProjects`, and `getBoard` each looked up the session.
- Each lookup called `getAuth()`, which built a new Better Auth instance.
  Building one sets up every plugin, and each new instance runs the OAuth
  provider's resource seed, a D1 read.

The first Production performance run also failed. GitHub's runner scored a
Lighthouse median of 93 where PageSpeed Insights reported 97, so 95 was the
wrong minimum for a runner.

## Behavior and configuration changes

- **`getAuth()` caches the instance.** It validates the configuration as
  before, then returns `authFor(environment, origin)`, which keeps one
  instance per origin. A different secret, sender, Turnstile key, or D1
  binding builds a new one, and the cache holds at most eight origins.
- **`getSessionFromHeaders()` caches the session per request.** It runs
  through `memoizeForRequest()` in `src/platform/request-context.ts`, keyed by
  the cookie and `Authorization` headers. Concurrent callers share one
  lookup, and a failed lookup is retried. Outside a request nothing is cached.
- **Lighthouse thresholds:**
  - `budgets.lighthouseAlarm` of 90 is the default minimum for
    `pnpm perf:lighthouse`, in CI and after each deploy
  - `budgets.lighthouseProduction` of 95 stays the budget, measured with
    PageSpeed Insights
- **Docs:**
  - PERFORMANCE records the board's numbers, the derivation, and the runner
    difference
  - OVERVIEW names PageSpeed Insights for the Lighthouse budget
  - AGENTS says to use the two cached helpers
  - FEATURES and STATUS record the F-019 deploy

## Migrations and environment changes

None.

## Validation evidence

Local:

- The Workers-runtime suite passed with 199 tests, 5 of them new:
  - `authFor` reuses an instance per configuration and origin, and builds a
    new one when the secret or Turnstile keys change
  - `memoizeForRequest` runs once per key within a request, shares
    concurrent calls, keeps requests apart, and retries after a failure
- **Timing:** in the Workers test runtime, building an instance took 0.7 ms,
  and a session lookup took 2.15 ms on a new instance and 0.05 ms on a reused
  one.
- `pnpm verify` without `.dev.vars` or `.env`: 199 Worker, 21 UI, 23 setup,
  and 13 script tests passed, with format, lint, docs, types, boundaries, and
  build.
- `pnpm cf:dry-run:production` and `pnpm cf:dry-run:default` passed, at
  9777.42 KiB.
- `pnpm test:e2e` with the system Chrome: 3 passed; realtime create 4 ms and
  move 5 ms.
- **A race the new test found.** Two instances initializing at once for the
  same origin both insert the MCP resource row. The OAuth provider skips the
  duplicate only when the error message says `UNIQUE`, and drizzle's wrapper
  message does not, so the second insert surfaced as an unhandled error.
  Production's row already exists, so only a fresh database can hit it. The
  test waits for each instance's `$context` before building the next, and
  caching means production now builds one instance per origin per isolate.

Production, 2026-09-27, merge commit `8da5e5a`:

- Workers Build `9b072f3f` deployed version `028967ae` at 18:07 UTC and passed
  its post-deploy smoke. The pinned smoke passed at 18:11 UTC.
- **Production performance run:** the landing JavaScript check passed at
  144.8 KB. Lighthouse scored 71, 96, 96, 96, and 96 on GitHub's runner,
  median 96, against the minimum of 90.
- **Board:** fifteen signed-in board loads took a p50 of 145 ms and a p75 of
  204 ms of Worker wall time, down from a p75 of 407 ms. CPU was p50 54 ms and
  p75 76 ms, down from a p75 of 129 ms.
- `pnpm perf:ttfb -- --rounds 5`: landing page p75 200 ms from Tunis and
  264 ms from US East. Derived board TTFB is about 336 ms from Tunis and
  400 ms from US East, within the 400 ms budget and at its limit for US East.

## Deployment state

| Target     | Commit                                | URL                        | Date       | Result |
| ---------- | ------------------------------------- | -------------------------- | ---------- | ------ |
| Local      | Working tree based on `c957dea`       | —                          | 2026-09-27 | Passed |
| Production | `8da5e5a` / Worker version `028967ae` | `https://core.tanbase.dev` | 2026-09-27 | Passed |

## Rollback notes

Revert the change. Each call builds its own Better Auth instance and looks up
the session again, as before; nothing stored changes.

## Remaining work

- After this deploys, load the board about ten times signed in, then derive
  the board TTFB again and record it in PERFORMANCE.
- If the board is still over budget, the next step is the second projects
  read: `getBoard` lists projects that the layout already has.
