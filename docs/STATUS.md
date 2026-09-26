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
DKIM, and DMARC passing.

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

F-012 due-date reminders are live: the hourly cron enqueues due tasks on
`tanbase-core-email`, and on 2026-09-26 the first production reminder arrived
from `noreply@send.tanbase.dev` at the 10:00 UTC run, with `reminder_sent_at`
recorded once.

F-013 and F-014 AI task breakdown are live: on 2026-09-26 a production
breakdown added seven subtasks to a board on `core.tanbase.dev` through the
`default` AI Gateway for $0.000086, within the per-user daily quota.

F-015 MCP server is live: on 2026-09-26 Claude connected to
`https://core.tanbase.dev/mcp` through Better Auth's OAuth flow and used the
task tools. The first attempt failed because the Worker tried to fetch its own
JWKS over its hostname; it now reads the keys in-process.

Agent discovery for F-015 is live
([ADR-0015](decisions/0015-worker-served-agent-discovery.md)): the Worker
negotiates Markdown for the homepage, no longer answers non-HTML page requests
with a 500, and serves the API catalog, AI Catalog, MCP server card, and agent
skills index; pages register the task tools through WebMCP. On 2026-09-26 the
isitagentready.com scan rose from level 2, Bot-Aware, to level 5,
Agent-Native. DNS-AID waits on the operator enabling DNSSEC and adding its
record; the root protected resource metadata and auth.md checks fail by
design.

The production Worker runs next to its D1 primary in Marseille. Server
functions for traffic entering Cloudflare far away, such as Rio de Janeiro,
fell from seconds to about 100 ms of Worker time.

A resumable guided installer automates local preparation, account and resource
selection, D1 provisioning and migrations, Better Auth secret deployment,
canonical URL reconciliation, deployment, and production smoke. Its external
fresh-account, under-15-minute acceptance test is still pending.

## Verification snapshot

| Target        | Commit                                | URL / resource                         | Date                 | Evidence                                                                                                                                                                                                                                                         |
| ------------- | ------------------------------------- | -------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production    | `9e695ab` / Worker version `fd71435d` | `https://core.tanbase.dev`             | 2026-09-26 20:43 UTC | Agent discovery: Workers Build `a5d3387f` post-deploy smoke, now covering Markdown and every discovery document, passed; independent smoke passed; the scan found Markdown, the API catalog, server card, skills index, three WebMCP tools, and the ARD manifest |
| Production    | `244e2ea` / Worker version `217220f7` | `https://core.tanbase.dev`             | 2026-09-26 19:53 UTC | F-015: Claude connected over OAuth; `/mcp` answered 200 with no 500s after the in-process JWKS fix (Workers Build `17dc0246`); migration `0004` applied by `becfb2d0`                                                                                            |
| Production    | `05e926e` / Worker version `71ef181c` | `https://core.tanbase.dev`             | 2026-09-26 15:41 UTC | F-013/F-014: Workers Build `7c13a06c` applied `0003` and created the Workflow; smoke passed on retry after a brief asset 404; a production breakdown added seven subtasks and AI Gateway logged $0.000086                                                        |
| Production    | `c685ee5` / Worker version `cb0ad7be` | `https://core.tanbase.dev`             | 2026-09-26 10:00 UTC | F-012: Workers Build `34bb2c71` post-deploy smoke passed; the 10:00 UTC cron enqueued 1 reminder, the consumer sent it, and D1 recorded `reminder_sent_at`; operator received the email                                                                          |
| Production    | `8d2581d` / Worker version `cfb92e4c` | `https://core.tanbase.dev`             | 2026-09-25 22:58 UTC | Placement next to D1: Workers Build `1984aacc` post-deploy smoke passed; `cf-placement: remote-MRS`; server functions through `GIG` 24–165 ms of wall time, down from 1.7–4.3 s; board Live                                                                      |
| Production    | `9712b8e` / Worker version `d97edb50` | `https://core.tanbase.dev`             | 2026-09-25 22:23 UTC | F-011 and version-aware smoke: Workers Build `adb4430f` post-deploy smoke passed on the first attempt; operator synced two devices; room held two sockets for about 42 s with 402 ms of active time                                                              |
| Production    | `eb0e127` / Worker version `d7d9401f` | `https://core.tanbase.dev`             | 2026-09-25 22:10 UTC | F-011: Workers Build `4bbe27e4` deployed `BoardRoom` but its smoke reached `SIN`, still serving older versions; independent smoke passed with `realtime: ok`                                                                                                     |
| Production D1 | `131393d`                             | `3736933e-6d18-4dbb-aba1-ccd046861b2b` | 2026-09-26           | `0000` through `0004` applied; Workers Build `becfb2d0` applied `0004`                                                                                                                                                                                           |
| Production    | `dfe4f4b` / Worker version `27b14b56` | `https://core.tanbase.dev`             | 2026-09-25 21:50 UTC | F-010: Workers Build `6db0c3c8` applied migration `0002`, deployed `FILES`, and passed post-deploy smoke; health `files: ok`; unauthenticated upload `401`/`403` and download `401`; operator confirmed upload, download, and delete                             |
| Production    | `fe633cf` / Worker version `1c3b3ddf` | `https://core.tanbase.dev`             | 2026-09-25 19:18 UTC | F-018 health and analytics: Workers Build `50df91c9` post-deploy smoke passed; CSP allows `https://*.posthog.com`; events sent to `eu.i.posthog.com` with no cookies or storage; operator confirmed PostHog receives events                                      |
| Production    | `3fa7164` / Worker version `c38f520e` | `https://core.tanbase.dev`             | 2026-09-25 10:30 UTC | F-018 headers: Workers Build `927894c6` post-deploy smoke with header and nonce assertions passed; browser under the live CSP hydrated with zero violations                                                                                                      |
| Production    | `b811368` / Worker version `0519d547` | `https://core.tanbase.dev`             | 2026-09-25 09:17 UTC | Email: Workers Build `7ab31bd3` post-deploy smoke passed; restricted `EMAIL` binding deployed. Operator-reported full auth journey passed with SPF, DKIM, and DMARC passing                                                                                      |
| Production    | `3ab15ae` / Worker version `aae32e59` | `https://core.tanbase.dev`             | 2026-09-25 09:00 UTC | F-006: Workers Build `a763606d` post-deploy smoke, including token-less sign-in rejection, passed on the first attempt; independent smoke passed; forged token returned `403`; the managed widget rendered                                                       |
| Production    | `0c6ea5a` / Worker version `b469d461` | `https://core.tanbase.dev`             | 2026-09-24 20:08 UTC | Canonical origin: Workers Build `fbf5f087` post-deploy smoke passed; HTTPS, apex, and `www` redirects passed                                                                                                                                                     |
| Production    | `fcdee3c` / Worker version `dfc781da` | `https://tanbase-core.tanfust.com`     | 2026-09-24 19:27 UTC | Former hostname, retired later that day: full smoke passed after the secret was set                                                                                                                                                                              |

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

- DNS-AID needs DNSSEC on the `tanbase.dev` zone, which is off, and an SVCB
  record under `_agents`; both are operator steps in
  [Agent discovery](AGENT_DISCOVERY.md#dns-aid).

## Last known deployed commit

Production runs merge commit `9e695ab` as Worker version `fd71435d`, deployed
by Workers Build `a5d3387f` at 2026-09-26 20:37 UTC with agent discovery. Its
post-deploy smoke passed on the first attempt.

The F-015 MCP server, the in-process JWKS fix, and asset recovery shipped in
version `217220f7` from `244e2ea`.

F-013 and F-014 AI task breakdown shipped in version `71ef181c` from
`05e926e`.

F-012 reminders shipped in version `cb0ad7be` from `c685ee5`.

Placement next to the D1 primary
([ADR-0011](decisions/0011-placement-near-d1.md)) shipped in version
`cfb92e4c` from `8d2581d`.

F-011 and version-aware smoke shipped in version `d97edb50` from `9712b8e`; the
first F-011 deployment, `d7d9401f` from `eb0e127`, is recorded above.

F-010 attachments shipped in version `27b14b56` from `dfe4f4b`.

F-018 analytics shipped in version `1c3b3ddf` from `fe633cf`; the security
headers in `c38f520e` from `3fa7164`.

Update this file after every first-of-kind production smoke check. Keep local
verification and production deployment evidence separate.
