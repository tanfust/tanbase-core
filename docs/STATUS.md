---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-18
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
truthful deferred capabilities remain unpublished. The project/task D1 and
Drizzle foundation is implemented and verified locally. Remote D1 creation,
migration, preview, and production rollout remain blocked on access to the
Cloudflare account that owns the live Worker.

## Verification snapshot

| Target         | Commit                                     | URL                                                | Date                 | Evidence                                                                                                  |
| -------------- | ------------------------------------------ | -------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| Local          | Working tree based on `d6a81bc32d0d79`     | `http://localhost:3005`                            | 2026-09-18           | D1 migration, idempotent seed, verify, local smoke, and both deployment dry runs passed                   |
| Branch preview | `d6a81bc32d0d79b6b56dd835ebbe0ee9446bb081` | No URL generated                                   | 2026-09-18           | Upload failed because neither accessible account contains the `tanbase-core` Worker; smoke could not run  |
| Production     | `efd9161` / Worker version `d91d365d`      | `https://tanbase-core.tanfust.com`                 | 2026-09-17 16:42 UTC | DNS, TLS, exact HTTP-to-HTTPS redirect, and HTML discovery smoke passed; Markdown negotiation returns 500 |
| Legacy preview | Uncommitted tree based on `2522a336f0bd`   | `https://tanbase-core-preview.tanfust.workers.dev` | 2026-09-16 21:05 UTC | Smoke passed; version `7dd0dc57-8002-48c4-8fe8-f501fbc48067`                                              |

The legacy preview belongs to the superseded two-Worker topology. It is not
evidence that the active same-Worker branch-preview flow works.

The current D1 slice is a working tree based on
`d6a81bc32d0d79b6b56dd835ebbe0ee9446bb081`. Workers-runtime tests, the local
migration, idempotent seed, local smoke, and deployment dry runs pass.

## Known blockers

- Upload and smoke the first same-Worker branch preview; production success is
  not evidence for the unpromoted preview path.
- The available Cloudflare accounts do not contain the live `tanbase-core`
  Worker. Obtain access to its owning account before creating
  `tanbase-core-preview` and `tanbase-core-production`, recording IDs, or
  running any remote migration or deployment.
- Upgrade the `tanfust.com` Free zone to a supported plan before enabling
  Cloudflare Markdown for Agents, then pass the production smoke check with
  `--expect-markdown`.
- The public health endpoint is intentionally minimal until the hardening slice.
- Preview URLs will need a replacement strategy before Durable Objects are added.

## Last known deployed commits

- Same-Worker branch preview: upload attempted from `d6a81bc32d0d79`; no URL
  was generated because the target Worker was not present in either accessible
  Cloudflare account.
- Production: commit `efd9161`, active Worker version `d91d365d`, live smoke
  passed at 2026-09-17 16:42 UTC.
- Legacy isolated preview: uncommitted tree based on `2522a336f0bd`; Cloudflare
  version `7dd0dc57-8002-48c4-8fe8-f501fbc48067`.

Update this file and the active deployment-ownership change record after every
first-of-kind remote smoke check. Keep local, preview, production, and legacy
evidence in separate rows.
