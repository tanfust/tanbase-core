---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-25
---

# 2026-09-25: Restore dev-server hydration

## Summary

Fixed a regression from the security-headers change that stopped `pnpm dev`
and `pnpm test:e2e` pages from hydrating, and added a CI check that loads the
dev server's client module graph.

## Motivation

The router read the CSP nonce through a dynamic import of
`src/platform/request-context`, guarded by `import.meta.env.SSR`. Production
builds removed that branch as dead code, so every build, dry run, smoke check,
and production browser check passed. The Vite dev server kept the import, and
TanStack import protection rejected it, so the client entry failed to load in
development. The browser suite surfaced the failure while F-010 was being
built.

## Behavior and configuration changes

- `src/router.tsx` reads the nonce with `createIsomorphicFn()`. TanStack's
  compiler removes the server branch and its import from the client module in
  both the dev server and builds.
- Added `pnpm test:dev-client`, which starts the dev server, walks the client
  module graph from the rendered entry and the router, and fails when any
  module does not load. The CI Cloudflare job now runs it.

## Migrations and environment changes

None.

## Validation evidence

Local:

- `pnpm test:e2e` on the unchanged browser journey — both journeys passed
  against the dev server; before the fix the first page never hydrated.
- `pnpm test:dev-client` — passed in 4 seconds with 68 client modules loaded.
  With the previous router restored, it failed on `/src/router.tsx` with
  HTTP 500.
- `pnpm build` then `vite preview` — all four scripts on `/login` carried the
  CSP nonce, and the client bundle contained no request-context code.
- `pnpm verify` — passed: 42 maintained documents, 54 Workers-runtime tests, one
  component test, 19 installer tests, import/database boundaries, and the build.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result                                    |
| ---------- | ------------------------------- | -------------------------- | ---------- | ----------------------------------------- |
| Local      | Working tree based on `10401e8` | `http://localhost:3110`    | 2026-09-25 | Browser suite and dev-client check passed |
| Production | —                               | `https://core.tanbase.dev` | —          | Not deployed; production was unaffected   |

## Rollback notes

Revert this change. Production behavior is identical before and after.

## Remaining work

- Consider running the browser suite in CI.
