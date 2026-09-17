---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-17
---

# Current status

This is a dated snapshot, not a deployment ledger. Cloudflare Builds and Worker
deployment history are the current operational record.

## Milestone

The Worker foundation and authentic agent-discovery baseline are locally
implemented. Cloudflare Workers Builds owns remote deployment: branch previews
and production target one Worker, with preview code uploaded as unpromoted
versions. The repository now includes the pnpm alignment prepared after the
first failed production build, but a successful remote retry is not recorded.
The canonical production hostname has been selected but does not currently
resolve. D1 remains the next product slice.

## Verification snapshot

| Target         | Commit                                   | URL                                                | Date                 | Evidence                                                                 |
| -------------- | ---------------------------------------- | -------------------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| Local          | Working tree based on `819ddcd`          | Local development and production-mode preview      | 2026-09-17           | Verify, both dry runs, and local and production-mode smoke checks passed |
| Branch preview | Not uploaded                             | Generated per Worker version                       | —                    | Branch builds and preview URLs configured; first upload/smoke is pending |
| Production     | No deployment recorded                   | `https://tanbase-core.tanfust.com`                 | 2026-09-17           | DNS resolution failed; HTTPS redirect and live smoke remain unverified   |
| Legacy preview | Uncommitted tree based on `2522a336f0bd` | `https://tanbase-core-preview.tanfust.workers.dev` | 2026-09-16 21:05 UTC | Smoke passed; version `7dd0dc57-8002-48c4-8fe8-f501fbc48067`             |

The legacy preview belongs to the superseded two-Worker topology. It is not
evidence that the active same-Worker branch-preview flow works.

## Known blockers

- Commit and push the agent-discovery change on a non-production branch, then
  smoke its generated preview URL before merge.
- Attach `tanbase-core.tanfust.com` to the production Worker, wait for DNS and
  TLS activation, and configure the hostname-scoped HTTP-to-HTTPS redirect.
- Merge only after preview verification, then smoke the canonical production
  URL and record the deployed commit and UTC time.
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
