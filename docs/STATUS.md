---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-18
---

# Current status

This is a dated snapshot, not a deployment ledger. Cloudflare Builds and Worker
deployment history are the operational record.

## Milestone

The Worker foundation and public agent-discovery baseline are live on the
canonical production hostname. The project/task D1 and Drizzle foundation is
implemented and verified locally. The default deployment topology now includes
only isolated local development and production; branch previews are optional.

Production D1 creation, migration, and deployment remain blocked on access to
the Cloudflare account that owns the live Worker. Cloudflare Markdown for Agents
remains separately gated by the zone plan.

## Verification snapshot

| Target     | Commit                                | URL                                | Date                 | Evidence                                                                                     |
| ---------- | ------------------------------------- | ---------------------------------- | -------------------- | -------------------------------------------------------------------------------------------- |
| Local      | Working tree based on `e531853`       | `http://localhost:3005`            | 2026-09-18           | D1 migration, idempotent seed, verify, local smoke, and production packaging dry run passed  |
| Production | `efd9161` / Worker version `d91d365d` | `https://tanbase-core.tanfust.com` | 2026-09-17 16:42 UTC | DNS, TLS, redirect, and HTML discovery smoke passed; the D1 foundation has not been deployed |

Historical preview experiments and their exact evidence remain in the immutable
[change records](changes/README.md). They are not requirements or evidence for
the active production-only topology.

## Known blockers

- The accessible Cloudflare accounts do not contain the live `tanbase-core`
  Worker. Obtain access to its owning account before creating
  `tanbase-core-production`, recording its ID, or running a remote migration.
- The production D1 migration, Worker deployment, and database-aware production
  smoke check have not run.
- Upgrade the `tanfust.com` Free zone before enabling Cloudflare Markdown for
  Agents, then pass the opt-in production smoke check.
- The public health endpoint remains intentionally minimal until hardening.

## Last known deployed commit

Production runs commit `efd9161`, Worker version `d91d365d`, with live HTML
discovery smoke passed at 2026-09-17 16:42 UTC. It does not include the current
D1 work.

Update this file after every first-of-kind production smoke check. Keep local
verification and production deployment evidence separate.
