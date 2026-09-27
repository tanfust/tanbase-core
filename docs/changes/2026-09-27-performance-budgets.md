---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-27
---

# 2026-09-27: Performance budgets measured and checked

## Summary

F-019 measures every budget in OVERVIEW and adds the checks. CI checks the
landing JavaScript and runs Lighthouse on a local production build, and a new
workflow audits production after each deploy. Time to first byte comes from
Globalping probes in Tunis and US East, and the results are in the new
[Performance](../PERFORMANCE.md) page. The landing JavaScript budget rises
from 100 KB to 150 KB. The toast system moves out of public pages, taking the
landing page from 159 KB to 145 KB.

## Motivation

The budgets were initial targets that nothing checked. The 100 KB
JavaScript budget was never measured: the landing page loaded 159 KB, and
React DOM alone is about 65 KB gzipped.

## Behavior and configuration changes

- **The toaster** moves from the root route into the `_app` layout. Only
  signed-in pages show toasts, so the landing and auth pages no longer load
  Base UI's toast code; the entry chunk fell from 109.1 to 102.5 KB gzipped.
- **New scripts,** all defaulting to the canonical origin:
  - `pnpm perf:bundle` sums the gzipped size of the scripts the homepage
    references and fails over the budget
  - `pnpm perf:lighthouse` runs Lighthouse mobile several times and fails when
    the median performance score is under the minimum; `--compress` puts a
    Brotli proxy in front of `vite preview`
  - `pnpm perf:ttfb` measures time to first byte through Globalping probes in
    Tunis and US East
  - `scripts/performance.mjs` holds the budgets and shared helpers, with unit
    tests
- **New dev dependencies:** `lighthouse` 13.5.0 and `chrome-launcher` 1.2.1.
  Lighthouse needs Node.js 22.19 or newer. Only the performance jobs run it,
  on Node.js 24.
- **CI:** a new **Performance budgets** job builds with `CLOUDFLARE_ENV=local`,
  serves the build, and runs both checks, with a Lighthouse minimum of 90.
  `env.local` is used because the top level binds Workers AI, which needs
  Cloudflare credentials to serve.
- **New workflow:** `.github/workflows/production-performance.yml` runs on
  every push to `main`. It waits for the commit's Workers Build, then checks
  the landing JavaScript and the median of five Lighthouse runs against 95. It
  reports and never blocks. Forks set `PRODUCTION_URL`.
- **Docs:**
  - the new `docs/PERFORMANCE.md`, and the docs index
  - OVERVIEW's budgets, with the reason for the JavaScript budget
  - FEATURES, DEVELOPMENT, AGENTS, and the deploy skill, which now checks the
    workflow after a deploy

## Migrations and environment changes

None. `output/lighthouse/` is ignored.

## Validation evidence

Local:

- `pnpm perf:bundle` against a local build of this change: 144.6 KB gzipped
  in 10 files, within the 150 KB budget.
- `pnpm perf:lighthouse -- --compress` against the local build: runs of 97,
  97, and 98, median 97. Without the proxy the same build scored 59 to 67,
  because the files were uncompressed.
- **Without credentials:** with the Cloudflare login hidden, a top-level
  build failed to serve because the Workers AI binding needs an API token.
  An `env.local` build served, with the same 144.6 KB and a median of 97.
- `pnpm test:e2e` with the system Chrome: 3 passed, with the toaster in its
  new place; realtime create and move each arrived in 5 ms.
- `node --test scripts/performance.test.mjs`: 4 passed.

Production, measured before this change deployed, on version `3aa997d3`:

- `pnpm perf:lighthouse -- --runs 5`: 98, 95, 96, 96, and 95, median 96,
  with a server response of about 430 ms from the Mac that ran it. An earlier
  run with a cold edge cache scored 79, 95, and 92.
- `pnpm perf:bundle` failed as expected at 159.3 KB: production still loaded
  the toast system.
- `pnpm perf:ttfb -- --rounds 5`:
  - Tunis: p50 152 ms, p75 200 ms, 5 samples, through `MRS`
  - US East: p50 223 ms, p75 279 ms, 20 samples, through `IAD`, `ORD`, and
    `EWR`
- **Workers Logs, 2026-09-20 to 2026-09-27:** CPU per server render had a p75
  of 40 ms over 272 page loads, p95 71 ms. There were no signed-in board
  loads, so board TTFB is not yet derived.

The previous deploy, `3d497fc` (#44, Workers Paid in the docs), deployed as
version `3aa997d3` through Workers Build `0dbf4209`. Its pinned smoke passed,
and the homepage's Markdown names Workers Paid.

Production, 2026-09-27, merge commit `c957dea`:

- Workers Build `b927aeef` deployed version `7df1cb2d` at 17:45 UTC and passed
  its post-deploy smoke. The pinned smoke passed at 17:56 UTC.
- `pnpm perf:bundle`: 144.6 KB gzipped in 10 files, down from 159.3 KB.
- **First Production performance run:** the JavaScript check passed at
  144.8 KB. Lighthouse on GitHub's runner scored 80, 96, 96, 93, and 91, a
  median of 93, so the run failed against 95. The runner scores lower than
  PageSpeed Insights, which reported 97; the follow-up change makes 90 the
  CI alarm.
- **Board:** ten signed-in board loads took a p75 of 407 ms of Worker wall
  time and 129 ms of CPU. Derived board TTFB is about 540 ms from Tunis and
  620 ms from US East, over the 400 ms budget.

## Deployment state

| Target     | Commit                                | URL                        | Date       | Result                    |
| ---------- | ------------------------------------- | -------------------------- | ---------- | ------------------------- |
| Local      | Working tree based on `3d497fc`       | `http://localhost:4391`    | 2026-09-27 | Passed                    |
| Production | `c957dea` / Worker version `7df1cb2d` | `https://core.tanbase.dev` | 2026-09-27 | Passed; board over budget |

## Rollback notes

Revert the change. The toaster returns to the root, and the performance job
and workflow go away; nothing stored changes.

## Remaining work

- Board TTFB: derive it from Workers Logs once signed-in board loads are
  recorded, and record it in `docs/PERFORMANCE.md`.
- The first Production performance workflow run, after this change deploys.
