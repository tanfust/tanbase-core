---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-17
---

# Current status

This is a dated snapshot, not a deployment ledger. Cloudflare Builds and Worker
deployment history are the current operational record.

## Milestone

The Worker foundation is locally implemented. Cloudflare Workers Builds owns
remote deployment: branch previews and production target one Worker, with
preview code uploaded as unpromoted versions. The first production build exposed
a pnpm runner mismatch before the build command ran; the repository now matches
Cloudflare's proven pnpm 10.11.1 install path. A successful retry remains
pending. D1 is the next product slice.

## Verification snapshot

| Target         | Commit                                   | URL                                                | Date                 | Evidence                                                                 |
| -------------- | ---------------------------------------- | -------------------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| Local          | Working tree based on `d057fe5c80b1`     | Local only                                         | 2026-09-17           | pnpm 10 frozen install, verify, typegen, and both dry runs passed        |
| Branch preview | Not uploaded                             | Generated per Worker version                       | —                    | Branch builds and preview URLs configured; first upload/smoke is pending |
| Production     | `d057fe5c80b1` build attempt             | Not assigned                                       | 2026-09-16 22:49 UTC | Dependency install failed before build; pnpm alignment prepared locally  |
| Legacy preview | Uncommitted tree based on `2522a336f0bd` | `https://tanbase-core-preview.tanfust.workers.dev` | 2026-09-16 21:05 UTC | Smoke passed; version `7dd0dc57-8002-48c4-8fe8-f501fbc48067`             |

The legacy preview belongs to the superseded two-Worker topology. It is not
evidence that the active same-Worker branch-preview flow works.

## Known blockers

- Push the verified pnpm-alignment change, then retry the failed Cloudflare
  build.
- Push a non-production branch, smoke its generated preview URL, then merge a
  reviewed commit to `main` and smoke production.
- The public health endpoint is intentionally minimal until the hardening slice.
- Preview URLs will need a replacement strategy before Durable Objects are added.

## Last known deployed commits

- Same-Worker branch preview: none recorded.
- Production: none recorded.
- Legacy isolated preview: uncommitted tree based on `2522a336f0bd`; Cloudflare
  version `7dd0dc57-8002-48c4-8fe8-f501fbc48067`.

Update this file and the active deployment-ownership change record after every
first-of-kind remote smoke check. Keep local, preview, production, and legacy
evidence in separate rows.
