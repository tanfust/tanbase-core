---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-20
---

# Current status

This is a dated snapshot, not a deployment ledger. Cloudflare Builds and Worker
deployment history are the operational record.

## Milestone

The Worker foundation and public agent-discovery baseline are live on the
canonical production hostname. The production D1 database now exists and its
additive project/task migration is applied. The transactional email module is
implemented with typed templates, an optional native Cloudflare Email Service
binding, and a safe logging fallback.

The new database binding and email module have not been deployed to the Worker.
Cloudflare Markdown for Agents remains separately gated by the zone plan.

The Better Auth D1 core is implemented locally with additive auth tables,
verified email/password and reset flows, server-side sessions, a protected app
layout, and idempotent default-project provisioning. Its UI and remote rollout
are not complete.

A resumable guided installer now automates local preparation, account and
resource selection, D1 provisioning and migrations, Better Auth secret
deployment, canonical URL reconciliation, deployment, and production smoke.
Its external fresh-account, under-15-minute acceptance test is still pending.

## Verification snapshot

| Target        | Commit                                | URL / resource                         | Date                 | Evidence                                                                                                               |
| ------------- | ------------------------------------- | -------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Local         | Working tree based on `3ae705f`       | Isolated local D1                      | 2026-09-20           | Guided local setup, 30 runtime tests, 14 installer tests, verify, production dry run, and deterministic typegen passed |
| Production D1 | `e531853`                             | `3736933e-6d18-4dbb-aba1-ccd046861b2b` | 2026-09-18           | Migration applied; `project` and `task` confirmed; no migrations remain                                                |
| Production    | `efd9161` / Worker version `d91d365d` | `https://tanbase-core.tanfust.com`     | 2026-09-17 16:42 UTC | DNS, TLS, redirect, and HTML discovery smoke passed; new binding and code not deployed                                 |

Cloudflare Workers Builds is configured with production branch `main`, build
command `pnpm verify`, and deploy command `pnpm cf:deploy:production`.
Non-production builds and Preview URLs are disabled; the production
`workers.dev` URL remains enabled.

Historical preview experiments and their exact evidence remain in the immutable
[change records](changes/README.md). They are not requirements or evidence for
the active production-only topology.

## Known blockers

- The Worker deployment and database-aware production smoke check have not run
  for the D1 and email work.
- Better Auth is not production-ready until `BETTER_AUTH_SECRET` is set, the
  auth migration is applied remotely, the auth UI is complete, transactional
  email delivery is proven, and Turnstile/rate limiting are enabled.
- Build `75df1b1e` for commit `a031fdf` failed during the production migration
  because the newly created D1 database did not yet have its ID in
  `wrangler.jsonc`. The working tree now contains the verified ID; a new commit
  and push are required to retry the build.
- The account dashboard reports that Email Sending requires Workers Paid, and
  the current Wrangler OAuth request is unauthorized (Cloudflare code 2036).
  Upgrade the Worker plan, confirm Email Sending access, onboard the sender
  domain, choose `EMAIL_FROM`, and run one controlled send.
- Upgrade the `tanfust.com` Free zone before enabling Cloudflare Markdown for
  Agents, then pass the opt-in production smoke check.
- The public health endpoint remains intentionally minimal until hardening.

## Last known deployed commit

Production runs commit `efd9161`, Worker version `d91d365d`, with live HTML
discovery smoke passed at 2026-09-17 16:42 UTC. It does not include the current
D1 binding or email module.

Update this file after every first-of-kind production smoke check. Keep local
verification and production deployment evidence separate.
