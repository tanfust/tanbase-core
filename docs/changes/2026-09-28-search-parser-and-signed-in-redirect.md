---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-28
---

# 2026-09-28: Search params by hand, and signed-in visitors skip sign-in

## Summary

`/app`'s search params are parsed by hand instead of by a Zod schema, which
takes Zod off the landing page. The landing page loads 147.6 KB of
JavaScript in 14 files, from 159.1 KB in 16, and its budget returns to
150 KB. A signed-in visitor to `/login` or `/sign-up` now goes to the board,
or to the page they were sent from, instead of seeing the form.

## Motivation

- After [F-028 to F-031](2026-09-27-tanstack-libraries.md) deployed, the
  landing page's Lighthouse median on GitHub's runner fell from 96 to 88. The
  router loads every route's options with the first page, so the Zod schema
  that validated `/app`'s search params shipped with the landing page. Its
  core is shared with the browser's WebMCP tools, which need full Zod, so the
  landing page carried 42.8 KB of minified Zod. The person chose to parse the
  params by hand over keeping Zod there.
- A signed-in person who followed the landing page's Sign in link saw the
  sign-in form, although `/app` would have opened their board.

## Behavior and configuration changes

- **Search params:** `parseBoardSearch()` in
  `src/modules/tasks/board-search.ts` replaces `boardSearchSchema`. It keeps
  the same rules: a malformed param falls back to its default, a list is
  kept only when every item is valid, and a search over 100 characters is
  dropped. Its parameter carries `SearchSchemaInput`, so links may leave
  every param out.
- **Chunks:** a Rolldown `codeSplitting` group in `vite.config.ts`,
  `app-shared`, keeps the small helpers that route options and route
  components share, such as server function stubs, the redirect helpers, the
  site config, and `seo()`, in one chunk instead of a file each. Only these
  leaf modules are grouped: a group that also took the router's modules made
  the page throw `t is not a function` before hydrating.
- **Signed-in visits:** `/login` and `/sign-up` check the session in
  `beforeLoad` and redirect to `signedInDestination()`: the `redirect`
  target, made safe, or `/app`. The sign-in page stays while an OAuth client
  waits on it, marked by a signed `sig` query, so an MCP authorization can
  continue. The forgot-password and reset-password pages stay open.
- **Budget:** `scripts/performance.mjs` and OVERVIEW put the landing
  JavaScript budget back to 150 KB.
- **Docs:** AGENTS, OVERVIEW, DEVELOPMENT, PERFORMANCE, FEATURES, and
  STATUS, which also record the F-028 to F-031 deploy. The
  [previous change record](2026-09-27-tanstack-libraries.md) gets its planned
  production evidence.

## Migrations and environment changes

None. No migration, binding, variable, secret, or dependency changed.

## Validation evidence

Local, on this branch:

- `pnpm verify` without `.dev.vars`: 229 Worker tests, 37 UI tests, 24 setup
  tests, and 13 script tests passed, with format, lint, docs, schema, types,
  boundaries, and build. New tests cover the parser's per-param fallbacks and
  `signedInDestination()`.
- `pnpm test:e2e` with the system Chrome: 5 passed. The views journey now
  also checks that, once signed in, the landing page's Sign in link opens
  `/app`, `/login?redirect=%2Fsettings` opens `/settings`, `/sign-up` opens
  `/app`, and `/login?sig=e2e-check` keeps the sign-in form.
- The same 5 journeys passed against a production build of the e2e Worker,
  `vite build --mode e2e` then `vite preview --mode e2e`, through a
  temporary Playwright config, to exercise the new chunking.
- A production build under `vite preview`: `pnpm perf:bundle` measured the
  landing page at 147.6 KB in 14 files, `/blog` at 144.4 KB, and the post at
  144.5 KB; the entry chunk contains no Zod.
- `pnpm cf:dry-run:production` passed.

## Deployment state

| Target     | Commit | URL                        | Date       | Result       |
| ---------- | ------ | -------------------------- | ---------- | ------------ |
| Local      | branch | `http://localhost:4391`    | 2026-09-28 | Passed       |
| Production | —      | `https://core.tanbase.dev` | —          | Not deployed |

## Rollback notes

Revert the merge. Nothing to migrate or clean up.

## Remaining work

- Deploy, then compare the Production performance run's median with 88, and
  run PageSpeed Insights by hand on `/` and a post.
- Moving the WebMCP tools' validation to the server would take full Zod out
  of the browser altogether.
