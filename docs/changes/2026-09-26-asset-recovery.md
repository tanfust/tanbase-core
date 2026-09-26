---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-26
---

# 2026-09-26: Reload once when a fresh deployment's assets are missing

## Summary

Production pages now include a small inline script that reloads the page once
when a same-origin script, stylesheet, or lazy chunk fails to load.

## Motivation

After the F-013 and F-014 deployment, the post-deploy smoke saw the new
version's HTML reference a fingerprinted script that returned `404` at the
edge; 17 seconds later it loaded. A visitor in that window would get a page
without its JavaScript until they reloaded by hand.

## Behavior and configuration changes

- `src/lib/asset-recovery.ts` holds the script as source text. It listens in
  the capture phase for `error` events from `script` and `link` elements with
  a same-origin URL, and for Vite's `vite:preloadError` (which it cancels),
  and reloads the page. A `sessionStorage` timestamp allows one reload per 30
  seconds, and nothing happens when storage is unavailable, so a real outage
  cannot cause a reload loop.
- `src/routes/__root.tsx` renders it with `ScriptOnce` in the document head,
  after the theme script, only outside development. It carries the CSP nonce
  like every inline script.
- Production smoke requires the script on the rendered page.

## Migrations and environment changes

None.

## Validation evidence

Local:

- `src/lib/asset-recovery.ui.test.ts` — 5 tests against the exact script
  source: one reload for a failed same-origin script or stylesheet, another
  only after 30 seconds, no reload for other origins, other elements, or plain
  page errors, a cancelled `vite:preloadError`, and no reload without storage.
- `pnpm verify` — passed.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result       |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------------ |
| Local      | Working tree based on `180d15a` | —                          | 2026-09-26 | Passed       |
| Production | —                               | `https://core.tanbase.dev` | —          | Not deployed |

## Rollback notes

Revert this change; the page then behaves as before, and smoke no longer
expects the script.

## Remaining work

- None. A request that lands on a location still serving the previous version
  can also fail the other way (old HTML, new assets); both resolve on reload.
