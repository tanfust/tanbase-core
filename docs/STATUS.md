---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-25
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

Authentication is live and verified in production. On 2026-09-25 the operator
completed sign-up, email verification, sign-in, task creation, sign-out, and
password reset on `core.tanbase.dev` through the production Turnstile widget.
Verification and reset emails arrived from `noreply@send.tanbase.dev` with SPF,
DKIM, and DMARC passing. Cloudflare Markdown for Agents remains separately
gated by the zone plan.

A resumable guided installer automates local preparation, account and resource
selection, D1 provisioning and migrations, Better Auth secret deployment,
canonical URL reconciliation, deployment, and production smoke. Its external
fresh-account, under-15-minute acceptance test is still pending.

## Verification snapshot

| Target        | Commit                                | URL / resource                         | Date                 | Evidence                                                                                                                                                                                                   |
| ------------- | ------------------------------------- | -------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local         | Working tree based on `3ab15ae`       | Isolated local D1                      | 2026-09-25           | Production email configuration: verify and production dry run passed                                                                                                                                       |
| Production D1 | `3ab15ae`                             | `3736933e-6d18-4dbb-aba1-ccd046861b2b` | 2026-09-25           | `0000` and `0001` applied; the Workers Build reported no migrations to apply                                                                                                                               |
| Production    | `b811368` / Worker version `0519d547` | `https://core.tanbase.dev`             | 2026-09-25 09:17 UTC | Email: Workers Build `7ab31bd3` post-deploy smoke passed; restricted `EMAIL` binding deployed. Operator-reported full auth journey passed with SPF, DKIM, and DMARC passing                                |
| Production    | `3ab15ae` / Worker version `aae32e59` | `https://core.tanbase.dev`             | 2026-09-25 09:00 UTC | F-006: Workers Build `a763606d` post-deploy smoke, including token-less sign-in rejection, passed on the first attempt; independent smoke passed; forged token returned `403`; the managed widget rendered |
| Production    | `0c6ea5a` / Worker version `b469d461` | `https://core.tanbase.dev`             | 2026-09-24 20:08 UTC | Canonical origin: Workers Build `fbf5f087` post-deploy smoke passed; HTTPS, apex, and `www` redirects passed                                                                                               |
| Production    | `fcdee3c` / Worker version `dfc781da` | `https://tanbase-core.tanfust.com`     | 2026-09-24 19:27 UTC | Former hostname, retired later that day: full smoke passed after the secret was set                                                                                                                        |

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

- The `tanbase.dev` zone is on the Free plan. Cloudflare Markdown for Agents
  requires Pro or higher before the opt-in production smoke check can pass.
- `main` has no GitHub branch protection, although the
  [deployment runbook](DEPLOYMENT.md) requires protected `main` with passing CI.
- The public health endpoint remains intentionally minimal until hardening.

## Last known deployed commit

Production runs merge commit `b811368` as Worker version `0519d547`, deployed
by Workers Build `7ab31bd3` at 2026-09-25 09:13 UTC with the restricted `EMAIL`
binding. The build's post-deploy smoke passed on its first attempt, and an
independent production smoke passed at 09:14 UTC. The operator then completed
the full authentication journey in production.

F-006 (Turnstile and `AUTH_LIMITER`) shipped in the previous version,
`aae32e59`, from merge commit `3ab15ae`.

Update this file after every first-of-kind production smoke check. Keep local
verification and production deployment evidence separate.
