---
status: active
audience: contributors, maintainers, operators
last_verified: 2026-09-28
---

# Performance

The budgets are in [OVERVIEW](OVERVIEW.md#performance-budgets), and
`scripts/performance.mjs` holds the numbers the scripts enforce; change both
together. This page says how each budget is measured and records the results.

## Checks

| Budget                          | Checked                                                                                                                                | Command                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Landing page JavaScript         | CI, on a local build of every push, for the landing page and the blog index; after each deploy, on production                          | `pnpm perf:bundle -- [--url <url>] [--path <path>]`                               |
| Lighthouse mobile performance   | PageSpeed Insights by hand, for the budget; Lighthouse in CI on the local build and after each deploy on production, alarming below 90 | `pnpm perf:lighthouse -- [--url <url>] [--path <path>] [--compress] [--runs <n>]` |
| Time to first byte              | By hand, from Tunis and US East                                                                                                        | `pnpm perf:ttfb -- [--url <url>] [--path <path>] [--rounds <n>]`                  |
| Worker CPU per server render    | By hand, in Workers Logs                                                                                                               | See [Worker CPU](#worker-cpu)                                                     |
| Realtime event between two tabs | `pnpm test:e2e`, locally                                                                                                               | The board journey fails when a change takes over a second to arrive               |

Without `--url`, the scripts target the canonical origin in `src/lib/site.ts`.

### Landing page JavaScript

`pnpm perf:bundle` fetches the homepage and counts what a first visit
downloads to render and hydrate: its module scripts, module preloads, and the
modules its inline bootstrap imports. Each file is measured uncompressed, then
gzipped at level 9; Cloudflare serves Brotli, which is smaller. `--path`
measures another public page against the same budget; CI measures `/blog`
too, since the blog's pages are public and indexable.

The router loads every route's options, such as `validateSearch`, `loader`,
and `head`, with the first page, so they count here even for routes the
landing page never shows. A Zod schema for `/app`'s search params added
14 KB and six more files, and the budget briefly rose to 160 KB; the params
are now parsed by hand. `vite.config.ts` also keeps the small helpers that
route options and route components share in one chunk, `app-shared`,
instead of a file each.

PostHog is not counted. It loads after hydration, and only when an
installation sets `POSTHOG_KEY`; on `core.tanbase.dev` it adds about 100 KB
gzipped.

### Lighthouse

`pnpm perf:lighthouse` runs Lighthouse 13.5's default mobile audit, a Moto G
Power on simulated slow 4G, several times and fails when the median
performance score is under the minimum. Every pass runs in the same browser.
On production, passes after the first often score lower than the first: on
2026-09-28 they did so by up to 14 points, while the Lighthouse CLI, which
starts a fresh browser each time as PageSpeed Insights does, scored 95 to 100. The simulation caps concurrent requests at 10, so the number of files
a page preloads matters as well as their size. It writes the median run's report and
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

The budget, 95, is the mobile score in
[PageSpeed Insights](https://pagespeed.web.dev), measured by hand. GitHub's
runners score the same page a few points lower: the first post-deploy run
scored a median of 93 while PageSpeed Insights reported 97. So both CI jobs
fail only below 90, an alarm for real regressions rather than a check of the
budget.

### Time to first byte

`pnpm perf:ttfb` measures from [Globalping](https://globalping.io)'s free
probes, which need no account. Each round uses the one probe in Tunis, on
Tunisia BackBone, and four in Virginia, New York, and New Jersey. TTFB is
what a first-time visitor waits for: DNS, TCP, TLS, and the server's first
byte. It reports p50 and p75, and the server wait on its own.

Probes send no cookies, and a measurement account's session must never go to
third-party probes. So the board, which needs a session, is derived. Its TTFB
is the landing page's measured TTFB plus the difference between the board's
and the landing page's p75 Worker wall time, from Workers Logs of real
signed-in loads. Both pages run in the same place, so the network part is the
same.

### Worker CPU

Workers Logs record `$workers.cpuTimeMs` for each request. In the dashboard,
open the Worker's **Observability** tab and filter `GET` requests with status
`200` to the server-rendered pages: `/`, `/login`, `/sign-up`,
`/forgot-password`, `/reset-password`, `/settings`, and `/app`. Leave out
`Accept: text/markdown` requests, which skip rendering. The same query runs
through the Workers Observability API's `telemetry/query` endpoint.

## Results

### 2026-09-28, launch readiness

In production on version `010905a2`, from `c812a1a`, and on a local build of
this change: the e2e Worker under `vite preview`, measured from a Mac.

| Budget                            | Target               | Measured                                                                                                                               | Result      |
| --------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Landing page JavaScript           | under 150 KB gzipped | Production 147.6 KB in 14 files; this change 147.9 KB in 14                                                                            | Met         |
| Blog JavaScript                   | under 150 KB gzipped | Production, the post 144.6 KB; this change 144.9 KB, and `/blog` 144.8 KB                                                              | Met         |
| Lighthouse mobile, production     | 95 or higher         | PageSpeed Insights at 09:11 UTC: 97 on `/` and 97 on `/blog/why-tanbase-core`, each with 100 for accessibility, best practices, SEO    | Met         |
| Lighthouse alarm, production      | 90 or higher         | Median 91 of 5 runs on GitHub's runner: 77, 91, 94, 86, 91                                                                             | Met         |
| Blog TTFB, p75, Tunis             | under 400 ms         | The post 128 ms and `/blog` 136 ms, 10 samples each, through `MRS`; a first run of the post measured 610 ms, see below                 | Met         |
| Blog TTFB, p75, US East           | under 400 ms         | The post 253 ms and `/blog` 227 ms, 40 samples each                                                                                    | Met         |
| Worker CPU per server render, p75 | under 50 ms          | Since 2026-09-27: `/` 17 ms over 775 loads, the post 15 ms over 26, `/blog` 16 ms over 7, `/login` 65 ms over 44, `/app` 68 ms over 55 | Met overall |

The pages that change, as the gzipped JavaScript each preloads before it
hydrates, on `main` and on this change:

| Page        | `main`                        | This change         |
| ----------- | ----------------------------- | ------------------- |
| `/login`    | 177.4 KB, then 18.2 KB of Zod | 184.2 KB, then none |
| `/sign-up`  | 176.8 KB, then 18.2 KB of Zod | 183.6 KB, then none |
| `/app`      | 306.7 KB in 30 files          | 275.3 KB in 29      |
| `/settings` | 244.0 KB, then 18.2 KB of Zod | 250.8 KB, then none |
| WebMCP      | 2.2 KB, then 18.2 KB of Zod   | 1.2 KB              |

Notes:

- **Zod in the browser.** On `main` the form chunk imported an 18.2 KB chunk
  of full Zod that no page preloaded, so the browser fetched it after the
  form chunk. The forms' schemas now use `zod/mini`, and the WebMCP tools
  describe their inputs with fixed JSON Schemas and leave validation to the
  server functions. The form chunk grew from 16.8 to 23.3 KB with the checks
  it uses and Zod's English messages, and no page loads full Zod.
- **The board's server render.** The `/app` route's server chunk fell from
  429 KB to 181 KB: the list view, with TanStack Table, is its own chunk,
  loaded only for that view, and the cards format dates with `Intl` instead
  of date-fns. Over five new isolates each, the first render of an 18-task
  board took a median of 132 ms on `main` and 121 ms with this change; warm
  renders stayed at about 10 ms. Most of `/app`'s production p75 is the
  first request in a new isolate: in a local profile of one, loading and
  building Better Auth took about 21 ms and tailwind-merge's first call
  about 8 ms.
- **The first blog TTFB run.** Ten rounds from Tunis to the post measured a
  p75 of 610 ms, with 477 ms of server wait; a second run minutes later
  measured 128 ms, and the post's Worker CPU p75 in Workers Logs is 15 ms.

### 2026-09-28, search params by hand

On a local build of the change that parses `/app`'s search params by hand
and groups the shared helpers, served by `vite preview`, and on production
before it.

| Budget                       | Target               | Measured                                                                                                        | Result       |
| ---------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------ |
| Landing page JavaScript      | under 150 KB gzipped | 147.6 KB in 14 files; production, version `d6c5a2f5`, served 159.1 KB in 16 files; before F-028, 145.1 KB in 10 | Met          |
| Blog JavaScript              | under 150 KB gzipped | `/blog` 144.4 KB and the post 144.5 KB, in 15 files each                                                        | Met          |
| Lighthouse alarm, production | 90 or higher         | Version `d6c5a2f5`: median 88 on GitHub's runner, 89 from a Mac; this change is not deployed yet                | After deploy |

Notes:

- **Why Zod left the route.** On `d6c5a2f5` the landing page loaded 42.8 KB
  of minified Zod. Zod Mini keeps a schema to about 5.5 KB, but Zod's core
  is one set of modules for the whole client, and the browser's WebMCP tools
  use full Zod, since the MCP SDK reads each tool's JSON Schema from it. So a
  schema in a route option carried the core that full Zod needs.
- **Grouping only leaf modules.** A group that also took the router's own
  modules brought the landing page to 5 files, but the page threw
  `t is not a function` before hydrating: the router's modules have to
  initialize in their own order. The `app-shared` group takes only small
  helpers, and all five browser journeys passed against a production build
  with it.
- **Real paint time was never the problem.** On `d6c5a2f5`, with mobile
  throttling in Chrome, the landing page's headline painted at about 1.2 s,
  before its scripts finished at about 2.6 s.

### 2026-09-27, TanStack libraries

On a local build of the F-028 to F-031 change, served by `vite preview`, from
Chrome 153 on a Mac. Production numbers follow the deploy.

| Budget                             | Target               | Measured                                                                                     | Result       |
| ---------------------------------- | -------------------- | -------------------------------------------------------------------------------------------- | ------------ |
| Landing page JavaScript            | under 160 KB gzipped | 159.1 KB in 16 files; `main` before the change, 145.1 KB in 10 files                         | Met          |
| Blog JavaScript                    | under 160 KB gzipped | `/blog` 155.9 KB and `/blog/why-tanbase-core` 156.0 KB, in 17 files each                     | Met          |
| Lighthouse alarm, local build      | 90 or higher         | Landing page median 97 of 3 runs; the post and the index each 97, with 100 for accessibility | Met          |
| Lighthouse mobile, production      | 95 or higher         | Not measured yet                                                                             | After deploy |
| TTFB and Worker CPU for blog pages | under 400 ms, 50 ms  | Not measured yet; a post is compiled once per isolate, then only rendered                    | After deploy |

Notes:

- **Where the landing page's 14 KB went.** A source-map comparison with
  `main` put 42.8 KB of minified Zod into the landing page's scripts, about
  12 KB gzipped, and about 3 KB more of minified router and Start code for
  search validation and the new routes. The blog's head tags are built on the Worker
  (`src/modules/blog/pages.server.ts`), which kept them out of the landing
  page.
- **The stats panel** is its own chunk, 42.7 KB gzipped, loaded only when
  someone opens the Stats view. The list view adds TanStack Table to the
  board's chunk, and the shared form chunk that TanStack Form lives in is
  17.3 KB gzipped; neither loads on the landing page.
- **Blog pages load no Markdown code.** TanStack Markdown's parser and
  renderer run on the Worker; its React renderer would have added about
  7.5 KB gzipped to every post
  ([ADR-0019](decisions/0019-blog-from-repository-markdown.md)).

### 2026-09-27, after the board fix

On version `028967ae`, from `8da5e5a`, which caches the Better Auth instance
per isolate and the session per request.

| Budget                            | Target               | Measured                                                                                        | Result            |
| --------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------- | ----------------- |
| Landing page JavaScript           | under 150 KB gzipped | 144.8 KB in 10 files, in the Production performance run                                         | Met               |
| Lighthouse alarm, production      | 90 or higher         | Median 96 of 5 runs on GitHub's runner; the first run scored 71, with 1,060 ms of blocking time | Met               |
| Landing page TTFB, p75, Tunis     | under 400 ms         | 200 ms, 5 samples, through `MRS`; p50 144 ms                                                    | Met               |
| Landing page TTFB, p75, US East   | under 400 ms         | 264 ms, 20 samples, through `IAD`, `ORD`, and `EWR`; p50 212 ms                                 | Met               |
| Board TTFB, p75, Tunis            | under 400 ms         | About 336 ms, derived: 200 ms plus 136 ms more Worker wall time than the landing page           | Met               |
| Board TTFB, p75, US East          | under 400 ms         | About 400 ms, derived: 264 ms plus the same 136 ms                                              | Met, at the limit |
| Worker CPU per server render, p75 | under 50 ms          | Unchanged overall at 40 ms; the board alone 76 ms                                               | Met overall       |

Fifteen signed-in board loads took 126 to 324 ms of Worker wall time, p50
145 ms and p75 204 ms, and 33 to 209 ms of CPU, p50 54 ms and p75 76 ms. The
first three, in new isolates, were the slowest; later loads took 126 to
170 ms. Before the fix, the p75 was 407 ms of wall time and 129 ms of CPU.
The board still reads the projects list twice, in the layout and in its own
loader; removing the second read is the next step if US East needs margin.

### 2026-09-27, first measurement

| Budget                            | Target               | Measured                                                                                              | Result      |
| --------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------- | ----------- |
| Landing page JavaScript           | under 150 KB gzipped | 144.6 KB in 10 files, on a local build of this change; production served 159.3 KB before it           | Met         |
| Lighthouse mobile, production     | 95 or higher         | PageSpeed Insights scored 97 on 2026-09-26; from a Mac, a median of 96 of 5 runs on `3aa997d3`        | Met         |
| Lighthouse alarm, local build     | 90 or higher         | Median 97 of 3 runs                                                                                   | Met         |
| Lighthouse alarm, production      | 90 or higher         | Median 93 of 5 runs on GitHub's runner, the first post-deploy run, on `7df1cb2d`                      | Met         |
| Landing page TTFB, p75, Tunis     | under 400 ms         | 200 ms, 5 samples, through `MRS`; p50 152 ms                                                          | Met         |
| Landing page TTFB, p75, US East   | under 400 ms         | 279 ms, 20 samples, through `IAD`, `ORD`, and `EWR`; p50 223 ms                                       | Met         |
| Board TTFB, p75, Tunis            | under 400 ms         | About 540 ms, derived: 200 ms plus 339 ms more Worker wall time than the landing page                 | Over, fixed |
| Board TTFB, p75, US East          | under 400 ms         | About 620 ms, derived: 279 ms plus the same 339 ms                                                    | Over, fixed |
| Worker CPU per server render, p75 | under 50 ms          | 40 ms over 272 page loads from 2026-09-20 to 2026-09-27, p50 12 ms, p95 71 ms; the board alone 129 ms | Met overall |
| Realtime event between two tabs   | under 1 s            | 5 ms for a create and 5 ms for a move, in `pnpm test:e2e`                                             | Met locally |

Notes:

- **The board.** Ten signed-in board loads on version `7df1cb2d` took 264
  to 853 ms of Worker wall time, p75 407 ms, and 52 to 313 ms of CPU, p75
  129 ms. The landing page's p75 wall time is 68 ms. One render made about
  12 sequential D1 queries, where about 4 would do:
  - the layout, `getProjects`, and `getBoard` each looked up the session
  - every lookup built a new Better Auth instance, whose OAuth resource seed
    reads D1
  - the projects list was read twice

  Version `028967ae` caches the instance per isolate and the session per
  request; see the results above.

- **Where the time goes.** Every request runs in Marseille, next to the D1
  primary ([ADR-0011](decisions/0011-placement-near-d1.md)). From Tunis,
  Cloudflare's Marseille location is also the nearest. US East requests enter
  at `IAD`, `ORD`, or `EWR` and cross the Atlantic, which is why their server
  wait is about 170 ms at p75 against about 80 ms from Tunis.
- **Lighthouse outliers.** One run in five sometimes scores 71 to 80. On
  GitHub's runner it is the first run, with 600 to 1,060 ms of blocking time
  while the browser warms up. The production workflow takes the median of
  five for that reason.
- **CPU and the plan.** Password sign-in and the first preview image render
  use over 100 ms of CPU each, which is why deployments need Workers Paid
  ([Deploying](DEPLOYMENT.md#workers-paid-is-required)).
- **Realtime in production** was observed between two devices on 2026-09-25,
  but has no timed measurement: that needs a signed-in session on both ends.
