---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-28
---

# 2026-09-28: Launch readiness

## Summary

Ahead of the outside fresh-account test, the README leads with the Deploy to
Cloudflare button, lists what the app is built with, and shows its
PageSpeed Insights and agent-readiness scores. The guided installer places
the Worker next to its new D1 primary, and no longer stops at the formatting
check it runs on the files it rewrote. No page loads full Zod, and the
board no longer loads TanStack Table or date-fns until the list view opens.
F-001B is closed, and the deploy of the
[previous change](2026-09-28-search-parser-and-signed-in-redirect.md) is
recorded.

## Motivation

- An outside tester will follow the README from a new Cloudflare account
  ([fresh-account test](../FRESH_ACCOUNT_TEST.md)). The README opened with
  the primitive map, and the button came after the cost section.
- **The installer could not finish a new install.** It rewrites names and
  values in `wrangler.jsonc` and `src/lib/site.ts`, then runs `pnpm verify`,
  whose first step checks formatting. A name of a different length changes
  where Prettier wraps a line: `updateWranglerInstallation()` for a fork
  named `fork` wrote a file Prettier rejected in every case tried, with
  nothing disabled and with email, files, or reminders turned off.
- **Forks ran on default placement.** The installer removed the production
  placement hint for any other database
  ([ADR-0011](../decisions/0011-placement-near-d1.md)), so visitors far from
  a fork's D1 primary paid a round trip per query.
- **Zod still reached the browser.** The form chunk imported an 18.2 KB
  chunk of full Zod that no page preloaded, so the sign-in, sign-up,
  settings, and board pages fetched it after their scripts. The WebMCP tools
  pulled the same chunk into every page in browsers that expose WebMCP.
- **The board's server render** had a p75 of 68 ms of Worker CPU over 55
  loads since 2026-09-27, against a 50 ms budget. Its route chunk held
  TanStack Table and date-fns, which the default board view never uses.

## Behavior and configuration changes

- **README:**
  - The Deploy to Cloudflare button follows the introduction, with the two
    screenshots in `docs/images/`, and Quick start opens with the button's
    steps.
  - The primitive-map table is gone. A new Built with section lists the
    Cloudflare products, each with the feature and binding it serves, then
    the TanStack libraries and the rest of the stack. The README test now
    checks that section against the homepage's primitive map.
- **Installer placement**
  ([ADR-0020](../decisions/0020-installer-chooses-placement.md)):
  - `pnpm run setup` reads where the production D1 primary is with one
    read-only `select 1`, remote with `--json`. It sets
    `env.production.placement` to the cloud region in the same city as the
    primary's colo, or else one region per location hint.
  - When the location cannot be read, setup continues: it keeps the hint
    for the same database and removes it for a different one.
    `--placement <region>` overrides the choice, and `--placement default`
    removes the hint. Setup prints one line naming the primary and the
    region it chose.
  - `pnpm run placement [--env <name>] [--write] [--account-id <id>]` does
    the same for an installation the installer did not make, such as the
    button's top level. It prints the primary and the recommended block, and
    `--write` writes it.
  - Hints are written on one line, as the repository writes them. The
    production pairing, `MRS` to `azure:francesouth`, is unchanged.
- **Installer formatting:** setup runs Prettier on `wrangler.jsonc` and
  `src/lib/site.ts` before each `pnpm verify`.
- **Zod in the browser:**
  - The auth and task schemas use `zod/mini`, with the same rules and
    messages. `@/lib/zod-config` also sets Zod's English messages, which
    full `zod` used to set as a side effect, so a rule without a message of
    its own reads the same everywhere.
  - The WebMCP tools take their names, descriptions, and JSON Schemas from
    `src/modules/mcp/tool-descriptions.ts`, which loads no Zod. Their server
    functions accept the input as sent and validate it with the tools' Zod
    schemas through `parseToolInput()`, returning Zod's message.
- **The board:**
  - The list view, `TaskTable`, loads through `lazy()`, like the stats.
  - Card and list dates render through `TaskDate` with `Intl` instead of
    date-fns. The cards now show the UTC day until the page hydrates, then
    the browser's, as the list already did; before, a card's day could
    differ between the server's HTML and the browser.
  - `getDb()` keeps one Drizzle instance per D1 binding instead of building
    one for every query.
  - The `_app` layout and the board's loader share one projects query per
    request through `memoizeForRequest()`.
- **Build:**
  - The `app-shared` chunk group also takes the task statuses, the skeleton,
    and TanStack Store's `useSelector`, which the lazy list view would
    otherwise split into chunks that the landing page preloads.
  - `routeDependencies` pre-bundles `zod/mini`, `zod/v4/core`, and Zod's
    English locale for the dev server.
- **Tests:**
  - The views journey waits for the board to hydrate before it opens the
    task dialog.
  - New Worker tests check that each tool's JSON Schema equals Zod's output,
    and cover `parseToolInput()`.
  - The installer's placement logic has 16 new setup tests, 40 in all.
- **Docs:** AGENTS, OVERVIEW, DEVELOPMENT, DEPLOYMENT, INSTALLING,
  AGENT_DISCOVERY, PERFORMANCE, FEATURES, and STATUS; ADR-0020, and a link
  to it from ADR-0011. F-001B is closed.

## Migrations and environment changes

None. No migration, binding, variable, secret, or dependency changed.
`package.json` gains the `placement` script.

## Validation evidence

Local, on this branch, with the system Chrome:

- `pnpm verify` without `.dev.vars`: 235 Worker tests, 38 UI tests, 40 setup
  tests, and 13 script tests passed, with format, lint, docs, schema, types,
  boundaries, and build.
- `pnpm test:e2e`: 5 passed. The first run failed twice: the dev server
  found `zod/mini` in the middle of the sign-in journey and reloaded the
  page, and the views journey clicked **New task** before the board had
  hydrated. The pre-bundled entry points and the wait fixed them.
- The same 5 journeys passed against a production build of the e2e Worker,
  `vite build --mode e2e` then `vite preview --mode e2e`, through a
  temporary Playwright config, to exercise the new chunk grouping.
- **Page JavaScript**, gzipped, preloaded before hydration, on the e2e build
  of `main` and of this branch:
  - `/` 147.6 KB and 147.9 KB, in 14 files each.
  - `/login` 177.4 KB, then 18.2 KB of Zod, and 184.2 KB, then none.
  - `/app` 306.7 KB and 275.3 KB.
  - WebMCP 2.2 KB, then 18.2 KB of Zod, and 1.2 KB.
  - The rest are in [Performance](../PERFORMANCE.md#2026-09-28-launch-readiness).
- **The board's server render**, with 18 tasks, the median of five new
  isolates each: 132 ms on `main` and 121 ms on this branch for the first
  render, and about 10 ms for warm renders on both. The route's server chunk
  fell from 429 KB to 181 KB.
- **The installer:** `pnpm test:setup` covers the placement table, which
  holds only region identifiers Cloudflare publishes, the parsing of
  Wrangler's output, and each keep, set, replace, and remove case. Every
  Wrangler result was mocked. A stand-in `pnpm` returning canned D1 output
  exercised `pnpm run placement` end to end: for `MRS` it reported
  `azure:francesouth`, which production already has, and for `SJC` it wrote
  `aws:us-west-1` into the top level, which then passed Prettier.
- `pnpm cf:dry-run:production` passed.

## Deployment state

| Target     | Commit | URL                        | Date       | Result       |
| ---------- | ------ | -------------------------- | ---------- | ------------ |
| Local      | branch | `http://localhost:3110`    | 2026-09-28 | Passed       |
| Production | —      | `https://core.tanbase.dev` | —          | Not deployed |

## Rollback notes

Revert the merge. Nothing to migrate or clean up. An installation made by the
new installer keeps its placement hint, which is valid on its own.

## Remaining work

- The first real Deploy to Cloudflare run and the outside fresh-account test
  (F-023).
- The installer's placement read has not run against a real account. It
  names the database by its ID and assumes the primary serves a REST
  `select 1`; if a replica answers, setup reads the location as unknown and
  keeps the old behavior.
- After deploy, compare `/app`'s CPU p75 in Workers Logs with 68 ms. Most of
  it is the first request in a new isolate: locally, building Better Auth
  took about 21 ms and tailwind-merge's first call about 8 ms. Whether
  loading those modules at isolate startup would move that time out of the
  request is untested.
- `/login` and the other auth pages fetch up to 3.4 KB of small chunks after
  their preloads, as they did before this change.
