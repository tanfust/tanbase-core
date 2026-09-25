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

F-010 task attachments on R2 are live: the `tanbase-core-files` bucket
(location WEUR) backs uploads, owner-only downloads, and cleanup on delete, and
the health endpoint reports `files: ok`.

F-011 live board on Durable Objects is live: on 2026-09-25 the operator saw
changes sync between two devices on `core.tanbase.dev`, and the board room
hibernated between events. The first F-011 Workers Build failed only because
its post-deploy smoke reached a location still serving the previous version;
smoke now waits until `/api/health` reports the deployed version.

A resumable guided installer automates local preparation, account and resource
selection, D1 provisioning and migrations, Better Auth secret deployment,
canonical URL reconciliation, deployment, and production smoke. Its external
fresh-account, under-15-minute acceptance test is still pending.

## Verification snapshot

| Target        | Commit                                | URL / resource                         | Date                 | Evidence                                                                                                                                                                                                                             |
| ------------- | ------------------------------------- | -------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Production    | `9712b8e` / Worker version `d97edb50` | `https://core.tanbase.dev`             | 2026-09-25 22:23 UTC | F-011 and version-aware smoke: Workers Build `adb4430f` post-deploy smoke passed on the first attempt; operator synced two devices; room held two sockets for about 42 s with 402 ms of active time                                  |
| Production    | `eb0e127` / Worker version `d7d9401f` | `https://core.tanbase.dev`             | 2026-09-25 22:10 UTC | F-011: Workers Build `4bbe27e4` deployed `BoardRoom` but its smoke reached `SIN`, still serving older versions; independent smoke passed with `realtime: ok`                                                                         |
| Production D1 | `dfe4f4b`                             | `3736933e-6d18-4dbb-aba1-ccd046861b2b` | 2026-09-25           | `0000` through `0002` applied; Workers Build `6db0c3c8` applied `0002`, and later builds reported no migrations to apply                                                                                                             |
| Production    | `dfe4f4b` / Worker version `27b14b56` | `https://core.tanbase.dev`             | 2026-09-25 21:50 UTC | F-010: Workers Build `6db0c3c8` applied migration `0002`, deployed `FILES`, and passed post-deploy smoke; health `files: ok`; unauthenticated upload `401`/`403` and download `401`; operator confirmed upload, download, and delete |
| Production    | `fe633cf` / Worker version `1c3b3ddf` | `https://core.tanbase.dev`             | 2026-09-25 19:18 UTC | F-018 health and analytics: Workers Build `50df91c9` post-deploy smoke passed; CSP allows `https://*.posthog.com`; events sent to `eu.i.posthog.com` with no cookies or storage; operator confirmed PostHog receives events          |
| Production    | `3fa7164` / Worker version `c38f520e` | `https://core.tanbase.dev`             | 2026-09-25 10:30 UTC | F-018 headers: Workers Build `927894c6` post-deploy smoke with header and nonce assertions passed; browser under the live CSP hydrated with zero violations                                                                          |
| Production    | `b811368` / Worker version `0519d547` | `https://core.tanbase.dev`             | 2026-09-25 09:17 UTC | Email: Workers Build `7ab31bd3` post-deploy smoke passed; restricted `EMAIL` binding deployed. Operator-reported full auth journey passed with SPF, DKIM, and DMARC passing                                                          |
| Production    | `3ab15ae` / Worker version `aae32e59` | `https://core.tanbase.dev`             | 2026-09-25 09:00 UTC | F-006: Workers Build `a763606d` post-deploy smoke, including token-less sign-in rejection, passed on the first attempt; independent smoke passed; forged token returned `403`; the managed widget rendered                           |
| Production    | `0c6ea5a` / Worker version `b469d461` | `https://core.tanbase.dev`             | 2026-09-24 20:08 UTC | Canonical origin: Workers Build `fbf5f087` post-deploy smoke passed; HTTPS, apex, and `www` redirects passed                                                                                                                         |
| Production    | `fcdee3c` / Worker version `dfc781da` | `https://tanbase-core.tanfust.com`     | 2026-09-24 19:27 UTC | Former hostname, retired later that day: full smoke passed after the secret was set                                                                                                                                                  |

Cloudflare Workers Builds is configured with production branch `main`, build
command `pnpm verify`, and deploy command `pnpm cf:deploy:production`. The
deploy command runs the production smoke suite against the canonical origin
after `wrangler deploy`. Non-production builds and Preview URLs are disabled;
the production `workers.dev` URL remains enabled. `main` is protected: changes
land through pull requests, the three Node verify jobs and the Cloudflare types
and dry-run job must pass, and the rules apply to administrators. The account is on Workers
Paid; Email Sending access was confirmed on 2026-09-24.

Historical preview experiments and their exact evidence remain in the immutable
[change records](changes/README.md). They are not requirements or evidence for
the active production-only topology.

## Known blockers

- The `tanbase.dev` zone is on the Free plan. Cloudflare Markdown for Agents
  requires Pro or higher before the opt-in production smoke check can pass.

## Last known deployed commit

Production runs merge commit `9712b8e` as Worker version `d97edb50`, deployed
by Workers Build `adb4430f` at 2026-09-25 22:22 UTC with the F-011 live board
and version-aware post-deploy smoke, which passed on the first attempt.
The first F-011 deployment, `d7d9401f` from `eb0e127`, is recorded above.

F-010 attachments shipped in version `27b14b56` from `dfe4f4b`.

F-018 analytics shipped in version `1c3b3ddf` from `fe633cf`; the security
headers in `c38f520e` from `3fa7164`.

Update this file after every first-of-kind production smoke check. Keep local
verification and production deployment evidence separate.
