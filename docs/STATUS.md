---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-17
---

# Current status

This is a dated snapshot, not a deployment ledger. Cloudflare Builds and Worker
deployment history are the current operational record.

## Milestone

The Worker foundation and authentic agent-discovery baseline are deployed on
the canonical production hostname. Cloudflare Workers Builds owns remote
deployment: branch previews and production target one Worker, with preview code
uploaded as unpromoted versions. The first successful production build and live
HTML discovery smoke are recorded below. Cloudflare Markdown for Agents remains
gated by the zone plan. The live readiness scan reports level 2, Bot-Aware;
truthful deferred capabilities remain unpublished. D1 remains the next product
slice.

## Verification snapshot

| Target         | Commit                                   | URL                                                | Date                 | Evidence                                                                                                  |
| -------------- | ---------------------------------------- | -------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| Local          | Working tree based on `efd9161`          | Local development and production-mode preview      | 2026-09-17           | Verify and diff check passed; earlier preview and production dry runs passed                              |
| Branch preview | Not uploaded                             | Generated per Worker version                       | —                    | Branch builds and preview URLs configured; first upload/smoke is pending                                  |
| Production     | `efd9161` / Worker version `d91d365d`    | `https://tanbase-core.tanfust.com`                 | 2026-09-17 16:42 UTC | DNS, TLS, exact HTTP-to-HTTPS redirect, and HTML discovery smoke passed; Markdown negotiation returns 500 |
| Legacy preview | Uncommitted tree based on `2522a336f0bd` | `https://tanbase-core-preview.tanfust.workers.dev` | 2026-09-16 21:05 UTC | Smoke passed; version `7dd0dc57-8002-48c4-8fe8-f501fbc48067`                                              |

The legacy preview belongs to the superseded two-Worker topology. It is not
evidence that the active same-Worker branch-preview flow works.

## Known blockers

- Upload and smoke the first same-Worker branch preview; production success is
  not evidence for the unpromoted preview path.
- Upgrade the `tanfust.com` Free zone to a supported plan before enabling
  Cloudflare Markdown for Agents, then pass the production smoke check with
  `--expect-markdown`.
- The public health endpoint is intentionally minimal until the hardening slice.
- Preview URLs will need a replacement strategy before Durable Objects are added.

## Last known deployed commits

- Same-Worker branch preview: none recorded.
- Production: commit `efd9161`, active Worker version `d91d365d`, live smoke
  passed at 2026-09-17 16:42 UTC.
- Legacy isolated preview: uncommitted tree based on `2522a336f0bd`; Cloudflare
  version `7dd0dc57-8002-48c4-8fe8-f501fbc48067`.

Update this file and the active deployment-ownership change record after every
first-of-kind remote smoke check. Keep local, preview, production, and legacy
evidence in separate rows.
