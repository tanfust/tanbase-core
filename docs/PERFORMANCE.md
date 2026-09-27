---
status: active
audience: contributors, maintainers, operators
last_verified: 2026-09-27
---

# Performance

The budgets are in [OVERVIEW](OVERVIEW.md#performance-budgets), and
`scripts/performance.mjs` holds the numbers the scripts enforce; change both
together. This page says how each budget is measured and records the results.

## Checks

| Budget                          | Checked                                                                          | Command                                                             |
| ------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Landing page JavaScript         | CI, on a local build of every push; after each deploy, on production             | `pnpm perf:bundle -- [--url <url>]`                                 |
| Lighthouse mobile performance   | CI, on the local build, minimum 90; after each deploy, on production, minimum 95 | `pnpm perf:lighthouse -- [--url <url>] [--compress] [--runs <n>]`   |
| Time to first byte              | By hand, from Tunis and US East                                                  | `pnpm perf:ttfb -- [--url <url>] [--path <path>] [--rounds <n>]`    |
| Worker CPU per server render    | By hand, in Workers Logs                                                         | See [Worker CPU](#worker-cpu)                                       |
| Realtime event between two tabs | `pnpm test:e2e`, locally                                                         | The board journey fails when a change takes over a second to arrive |

Without `--url`, the scripts target the canonical origin in `src/lib/site.ts`.

### Landing page JavaScript

`pnpm perf:bundle` fetches the homepage and counts what a first visit
downloads to render and hydrate: its module scripts, module preloads, and the
modules its inline bootstrap imports. Each file is measured uncompressed, then
gzipped at level 9; Cloudflare serves Brotli, which is smaller.

PostHog is not counted. It loads after hydration, and only when an
installation sets `POSTHOG_KEY`; on `core.tanbase.dev` it adds about 100 KB
gzipped.

### Lighthouse

`pnpm perf:lighthouse` runs Lighthouse 13.5's default mobile audit, a Moto G
Power on simulated slow 4G, several times and fails when the median
performance score is under the minimum. It writes the median run's report and
a summary of every run to `output/lighthouse/`.

- **CI** builds with `CLOUDFLARE_ENV=local` and serves the build with
  `vite preview`. The top level binds Workers AI, which runs only remotely and
  needs Cloudflare credentials; the browser bundle is the same. `vite
preview` sends files uncompressed, so `--compress` puts a Brotli proxy in
  front of it. SEO scores lower there, because robots.txt blocks crawlers
  outside production.
- **After each deploy,** `.github/workflows/production-performance.yml` waits
  for the Workers Build of the pushed commit, checks the landing JavaScript,
  which also warms the edge cache, and takes the median of five Lighthouse
  runs. It reports and never blocks a merge. Forks set the `PRODUCTION_URL`
  repository variable to audit their own site. Both jobs upload the report as
  an artifact.

### Time to first byte

`pnpm perf:ttfb` measures from [Globalping](https://globalping.io)'s free
probes, which need no account. Each round uses the one probe in Tunis, on
Tunisia BackBone, and four in Virginia, New York, and New Jersey. TTFB is
what a first-time visitor waits for: DNS, TCP, TLS, and the server's first
byte. It reports p50 and p75, and the server wait on its own.

Probes send no cookies, and a measurement account's session must never go to
third-party probes. So the board, which needs a session, is derived: the
landing page's TTFB plus the board's extra server time, from Workers Logs of
real board loads.

### Worker CPU

Workers Logs record `$workers.cpuTimeMs` for each request. In the dashboard,
open the Worker's **Observability** tab and filter `GET` requests with status
`200` to the server-rendered pages: `/`, `/login`, `/sign-up`,
`/forgot-password`, `/reset-password`, `/settings`, and `/app`. Leave out
`Accept: text/markdown` requests, which skip rendering. The same query runs
through the Workers Observability API's `telemetry/query` endpoint.

## Results

### 2026-09-27

| Budget                            | Target               | Measured                                                                                    | Result      |
| --------------------------------- | -------------------- | ------------------------------------------------------------------------------------------- | ----------- |
| Landing page JavaScript           | under 150 KB gzipped | 144.6 KB in 10 files, on a local build of this change; production served 159.3 KB before it | Met         |
| Lighthouse mobile, production     | 95 or higher         | Median 96 of 5 runs on version `3aa997d3`; PageSpeed Insights scored 97 on 2026-09-26       | Met         |
| Lighthouse mobile, local build    | 90 or higher         | Median 97 of 3 runs                                                                         | Met         |
| Landing page TTFB, p75, Tunis     | under 400 ms         | 200 ms, 5 samples, through `MRS`; p50 152 ms                                                | Met         |
| Landing page TTFB, p75, US East   | under 400 ms         | 279 ms, 20 samples, through `IAD`, `ORD`, and `EWR`; p50 223 ms                             | Met         |
| Board TTFB, p75                   | under 400 ms         | Not measured: Workers Logs held no signed-in board loads to derive it from                  | Pending     |
| Worker CPU per server render, p75 | under 50 ms          | 40 ms over 272 page loads from 2026-09-20 to 2026-09-27; p50 12 ms, p95 71 ms               | Met         |
| Realtime event between two tabs   | under 1 s            | 5 ms for a create and 5 ms for a move, in `pnpm test:e2e`                                   | Met locally |

Notes:

- **Where the time goes.** Every request runs in Marseille, next to the D1
  primary ([ADR-0011](decisions/0011-placement-near-d1.md)). From Tunis,
  Cloudflare's Marseille location is also the nearest. US East requests enter
  at `IAD`, `ORD`, or `EWR` and cross the Atlantic, which is why their server
  wait is about 170 ms at p75 against about 80 ms from Tunis.
- **Lighthouse outliers.** One run in five sometimes scores about 79, with LCP
  near 3.8 s. The production workflow takes the median of five for that
  reason.
- **CPU and the plan.** Password sign-in and the first preview image render
  use over 100 ms of CPU each, which is why deployments need Workers Paid
  ([Deploying](DEPLOYMENT.md#workers-paid-is-required)).
- **Realtime in production** was observed between two devices on 2026-09-25,
  but has no timed measurement: that needs a signed-in session on both ends.
