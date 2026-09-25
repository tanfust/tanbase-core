---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-24
---

# Current status

This is a dated snapshot, not a deployment ledger. Cloudflare Builds and Worker
deployment history are the operational record.

## Milestone

The Worker foundation, public agent-discovery baseline, D1 project/task
storage, Better Auth D1 core, authentication and task-board UI, and
transactional email module are deployed to production. Every D1 migration is
applied remotely, and the production Worker has its `BETTER_AUTH_SECRET`.

The canonical production origin is `https://core.tanbase.dev`
([ADR-0008](decisions/0008-canonical-production-domain.md)). The apex and `www`
temporarily redirect to it. The former `tanbase-core.tanfust.com` hostname was
removed from the Worker on 2026-09-24 and no longer resolves.

Authentication is not public-ready. Sign-up works, but verification and reset
emails are recorded as safe metadata only until the Worker's `EMAIL` binding and
sender are configured. Turnstile and the `AUTH_LIMITER` rate limit (F-006) are
implemented and verified locally. The production widget exists; its
`TURNSTILE_SECRET_KEY` Worker secret and the deployment are pending. Cloudflare Markdown for
Agents remains separately gated by the zone plan.

A resumable guided installer automates local preparation, account and resource
selection, D1 provisioning and migrations, Better Auth secret deployment,
canonical URL reconciliation, deployment, and production smoke. Its external
fresh-account, under-15-minute acceptance test is still pending.

## Verification snapshot

| Target        | Commit                                | URL / resource                         | Date                 | Evidence                                                                                                                              |
| ------------- | ------------------------------------- | -------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Local         | Working tree based on `fcdee3c`       | Isolated local D1                      | 2026-09-24           | Canonical-domain change: verify, production dry run, and local smoke passed                                                           |
| Production D1 | `0c6ea5a`                             | `3736933e-6d18-4dbb-aba1-ccd046861b2b` | 2026-09-24           | `0000` and `0001` applied; the Workers Build reported no migrations to apply                                                          |
| Production    | `0c6ea5a` / Worker version `b469d461` | `https://core.tanbase.dev`             | 2026-09-24 20:08 UTC | Workers Build `fbf5f087` post-deploy smoke passed on the first attempt; independent smoke and HTTPS, apex, and `www` redirects passed |
| Production    | `fcdee3c` / Worker version `dfc781da` | `https://tanbase-core.tanfust.com`     | 2026-09-24 19:27 UTC | Former hostname, retired later that day: full smoke passed after the secret was set                                                   |     |

Cloudflare Workers Builds is configured with production branch `main`, build
command `pnpm verify`, and deploy command `pnpm cf:deploy:production`. The
deploy command runs the production smoke suite against the canonical origin
after `wrangler deploy`. Non-production builds and Preview URLs are disabled;
the production `workers.dev` URL remains enabled. The account is on Workers
Paid; Email Sending access was confirmed on 2026-09-24.

Historical preview experiments and their exact evidence remain in the immutable
[change records](changes/README.md). They are not requirements or evidence for
the active production-only topology.

## Known blockers

- Better Auth is not public-ready until transactional email delivery is proven
  in production and F-006 passes its production check. The managed
  `core.tanbase.dev` widget and its site key exist; set the
  `TURNSTILE_SECRET_KEY` Worker secret before the F-006 deployment.
- `send.tanbase.dev` is onboarded to Email Sending (2026-09-24) with its
  `cf-bounce` MX, SPF, and DKIM records and a `p=reject` DMARC policy
  published. The Worker has no `EMAIL` binding or `EMAIL_FROM` yet. Add the
  restricted binding and a sender on `send.tanbase.dev`, then run one
  controlled send. Do not enable delivery before F-006 ships.
- The `tanbase.dev` zone is on the Free plan. Cloudflare Markdown for Agents
  requires Pro or higher before the opt-in production smoke check can pass.
- `main` has no GitHub branch protection, although the
  [deployment runbook](DEPLOYMENT.md) requires protected `main` with passing CI.
- The public health endpoint remains intentionally minimal until hardening.

## Last known deployed commit

Production runs merge commit `0c6ea5a` as Worker version `b469d461`, deployed
by Workers Build `fbf5f087` at 2026-09-24 20:07 UTC. The build's post-deploy
smoke passed against `https://core.tanbase.dev` on its first attempt, and an
independent production smoke passed at 2026-09-24 20:08 UTC.

The previous version, `dfc781da`, was created by the `BETTER_AUTH_SECRET`
upload at 2026-09-24 19:24 UTC on top of `fcdee3c`. Before that upload, `/app`
and `/api/auth/*` returned HTTP 500 and production smoke failed at the
protected-route check.

Update this file after every first-of-kind production smoke check. Keep local
verification and production deployment evidence separate.
