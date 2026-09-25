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

F-018 hardening is complete in production: security headers with a
nonce-based CSP, root error and 404 pages, request-ID structured logging, the
cached health check, and cookieless PostHog analytics reporting to the EU
project. Cloudflare Web Analytics also runs on the zone.

A resumable guided installer automates local preparation, account and resource
selection, D1 provisioning and migrations, Better Auth secret deployment,
canonical URL reconciliation, deployment, and production smoke. Its external
fresh-account, under-15-minute acceptance test is still pending.

## Verification snapshot

| Target        | Commit                                | URL / resource                         | Date                 | Evidence                                                                                                                                                                                                                    |
| ------------- | ------------------------------------- | -------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local         | Working tree based on `fe633cf`       | Isolated local D1                      | 2026-09-25           | Documentation-only evidence update: docs check passed                                                                                                                                                                       |
| Production D1 | `3ab15ae`                             | `3736933e-6d18-4dbb-aba1-ccd046861b2b` | 2026-09-25           | `0000` and `0001` applied; the Workers Build reported no migrations to apply                                                                                                                                                |
| Production    | `fe633cf` / Worker version `1c3b3ddf` | `https://core.tanbase.dev`             | 2026-09-25 19:18 UTC | F-018 health and analytics: Workers Build `50df91c9` post-deploy smoke passed; CSP allows `https://*.posthog.com`; events sent to `eu.i.posthog.com` with no cookies or storage; operator confirmed PostHog receives events |
| Production    | `3fa7164` / Worker version `c38f520e` | `https://core.tanbase.dev`             | 2026-09-25 10:30 UTC | F-018 headers: Workers Build `927894c6` post-deploy smoke with header and nonce assertions passed; browser under the live CSP hydrated with zero violations                                                                 |
| Production    | `b811368` / Worker version `0519d547` | `https://core.tanbase.dev`             | 2026-09-25 09:17 UTC | Email: Workers Build `7ab31bd3` post-deploy smoke passed; restricted `EMAIL` binding deployed. Operator-reported full auth journey passed with SPF, DKIM, and DMARC passing                                                 |
| Production    | `3ab15ae` / Worker version `aae32e59` | `https://core.tanbase.dev`             | 2026-09-25 09:00 UTC | F-006: Workers Build `a763606d` post-deploy smoke, including token-less sign-in rejection, passed on the first attempt; independent smoke passed; forged token returned `403`; the managed widget rendered                  |
| Production    | `0c6ea5a` / Worker version `b469d461` | `https://core.tanbase.dev`             | 2026-09-24 20:08 UTC | Canonical origin: Workers Build `fbf5f087` post-deploy smoke passed; HTTPS, apex, and `www` redirects passed                                                                                                                |
| Production    | `fcdee3c` / Worker version `dfc781da` | `https://tanbase-core.tanfust.com`     | 2026-09-24 19:27 UTC | Former hostname, retired later that day: full smoke passed after the secret was set                                                                                                                                         |

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

## Last known deployed commit

Production runs merge commit `fe633cf` as Worker version `1c3b3ddf`, deployed
by Workers Build `50df91c9` at 2026-09-25 12:35 UTC with the cached health
check and PostHog analytics. The build's post-deploy smoke passed, and an
independent production smoke passed at 19:18 UTC.

The F-018 security headers shipped in version `c38f520e` from merge commit
`3fa7164`; production email shipped in `0519d547` from `b811368`.

Update this file after every first-of-kind production smoke check. Keep local
verification and production deployment evidence separate.
