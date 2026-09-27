---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-27
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
project. Since 2026-09-26 PostHog also records uncaught browser exceptions for
Error Tracking and Core Web Vitals; source-map upload waits on three Workers
Builds variables. Cloudflare Web Analytics, whose beacon Cloudflare injects with
the page's CSP nonce, records web vitals for the zone too. Session replay is
off.

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
Agent-Native. On 2026-09-26 the operator enabled DNSSEC on `tanbase.dev` and
published the DNS-AID SVCB record, and the scan's DNS-AID check passes with
DNSSEC validation. The root protected resource metadata, auth.md, and A2A
agent card checks fail by design.

The F-016 landing page and SEO layer are live. The homepage explains what
TanBase Core is and shows the primitive map, the cost model, and the guided
installer commands. Indexing is opt-in: only `/` names a canonical URL and
carries `SoftwareSourceCode` JSON-LD, and every other page is `noindex`. On
2026-09-26 PageSpeed Insights on mobile scored 97 Performance, 100
Accessibility, 100 Best Practices, 100 SEO, and 4/4 Agentic Browsing, up from
95 Accessibility and 3/4 Agentic Browsing before the change.

F-017 preview images are live
([ADR-0018](decisions/0018-preview-images-on-the-worker.md)). The homepage
names `/og/home.png`, a 1200×630 card that Takumi draws on the Worker. Workers
Caching on the `OgImage` entrypoint keeps it until the next deploy. On
2026-09-27 the first production render took 312 ms of CPU, and every later
request was a cache `HIT`.

The production Worker runs next to its D1 primary in Marseille. Server
functions for traffic entering Cloudflare far away, such as Rio de Janeiro,
fell from seconds to about 100 ms of Worker time.

A resumable guided installer automates local preparation, account and resource
selection, D1 provisioning and migrations, Better Auth secret deployment,
canonical URL reconciliation, deployment, and production smoke. Its external
fresh-account, under-15-minute acceptance test is still pending.

Since 2026-09-27 the README has a Deploy to Cloudflare button for the generic
top-level configuration ([ADR-0017](decisions/0017-wrangler-configuration-layout.md)),
and a deployment works with no origin or email configured
([ADR-0016](decisions/0016-deploy-without-personalization.md)). No one has
run the button yet; the first run and the
[fresh-account test](FRESH_ACCOUNT_TEST.md) are pending.

## Verification snapshot

| Target        | Commit                                | URL / resource                         | Date                 | Evidence                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ------------------------------------- | -------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production    | `c957dea` / Worker version `7df1cb2d` | `https://core.tanbase.dev`             | 2026-09-27 17:56 UTC | F-019 performance budgets: Workers Build `b927aeef` deployed at 17:45 UTC and passed its post-deploy smoke; pinned smoke passed; the landing page loads 144.6 KB of gzipped JavaScript, down from 159.3 KB; the first Production performance run passed the JavaScript check and scored a Lighthouse median of 93 on GitHub's runner                                         |
| Production    | `3d497fc` / Worker version `3aa997d3` | `https://core.tanbase.dev`             | 2026-09-27 17:12 UTC | Workers Paid in the docs (#44): Workers Build `0dbf4209` deployed and passed its post-deploy smoke; pinned smoke passed; the homepage's deploy copy and Markdown name Workers Paid                                                                                                                                                                                           |
| Production    | `5d055b0` / Worker version `1590a9be` | `https://core.tanbase.dev`             | 2026-09-27 16:57 UTC | F-017 preview images: Workers Build `48697ce9` deployed at 16:56 UTC and passed its post-deploy smoke, which drew `/og/home.png` once in 312 ms of CPU; pinned smoke passed; later requests, including one with a query string, were `Cf-Cache-Status: HIT` without running the entrypoint; `og:image` names the image on the canonical origin                               |
| Production    | `b84bbfe` / Worker version `e83b7e10` | `https://core.tanbase.dev`             | 2026-09-27 15:52 UTC | F-023 part 2, generic top level and Deploy button: Workers Build `e09bd7f3` deployed `env.production` at 15:51 UTC and passed its post-deploy smoke, and the superseded `85d6338` build uploaded no version; pinned smoke passed; bindings, variables, secrets, placement, cron, and queue consumer unchanged from `8f17bbc6`; Turnstile and verified-email sign-in still on |
| Production    | `af8a708` / Worker version `8f17bbc6` | `https://core.tanbase.dev`             | 2026-09-27 13:54 UTC | F-023 part 1, runtime origin and email-optional verification: Workers Build `b8a6a35f` deployed at 13:26 UTC and passed its post-deploy smoke; pinned smoke passed; canonical, JSON-LD, and sitemap name the pinned `core.tanbase.dev`; with email delivery configured, login still asks for a verified email and the reset page shows no notice                             |
| Production    | `289d84c` / Worker version `5a41c0ea` | `https://core.tanbase.dev`             | 2026-09-27 11:30 UTC | F-020 agent layer: Workers Build `6cb8ec5b` deployed at 11:24 UTC and passed its post-deploy smoke; pinned smoke passed; the tasks view mapping it ships was exercised by the local browser journeys, since checking a signed-in board response in production needs the operator's session                                                                                   |
| Production    | `357239d` / Worker version `91965a6a` | `https://core.tanbase.dev`             | 2026-09-27 09:24 UTC | Roadmap scope: Workers Build `b99d9561` deployed and passed its post-deploy smoke; pinned smoke passed; the homepage and its Markdown no longer mention an invoice, and the cost section still lists the allowances, risks, and guardrails                                                                                                                                   |
| Production    | `9204d48` / Worker version `be3a85c9` | `https://core.tanbase.dev`             | 2026-09-26 22:59 UTC | F-016 landing page and SEO: Workers Build `8e1c71dc` deployed and passed its post-deploy smoke; pinned smoke passed; `/` has one canonical URL, `index, follow`, and `SoftwareSourceCode` JSON-LD, `/login` is `noindex` with no canonical; PageSpeed Insights mobile 97/100/100/100 and Agentic Browsing 4/4                                                                |
| Production    | `a2fe387` / Worker version `86a32108` | `https://core.tanbase.dev`             | 2026-09-26 21:57 UTC | Web vitals and deploy guard: Workers Build `9c9ca53f` ran the guard, which found its commit at the tip of `main` and deployed; post-deploy and pinned smoke passed; with PostHog requests aborted, the live page sent `$pageview` and a `$web_vitals` FCP event without attribution or query strings, and no CSP violations                                                  |
| Production    | `023fb25` / Worker version `6db1bd46` | `https://core.tanbase.dev`             | 2026-09-26 21:28 UTC | AI Catalog media type and PostHog Error Tracking: Workers Build `779bec50` passed its smoke, but the `d169717` build finished later and deployed `619071df`; `6db1bd46` was promoted with `wrangler versions deploy` at 21:27 UTC and pinned smoke passed; the scan reported `correctMediaType: true`                                                                        |
| Production    | `9e695ab` / Worker version `fd71435d` | `https://core.tanbase.dev`             | 2026-09-26 20:43 UTC | Agent discovery: Workers Build `a5d3387f` post-deploy smoke, now covering Markdown and every discovery document, passed; independent smoke passed; the scan found Markdown, the API catalog, server card, skills index, three WebMCP tools, and the ARD manifest                                                                                                             |
| Production    | `244e2ea` / Worker version `217220f7` | `https://core.tanbase.dev`             | 2026-09-26 19:53 UTC | F-015: Claude connected over OAuth; `/mcp` answered 200 with no 500s after the in-process JWKS fix (Workers Build `17dc0246`); migration `0004` applied by `becfb2d0`                                                                                                                                                                                                        |
| Production    | `05e926e` / Worker version `71ef181c` | `https://core.tanbase.dev`             | 2026-09-26 15:41 UTC | F-013/F-014: Workers Build `7c13a06c` applied `0003` and created the Workflow; smoke passed on retry after a brief asset 404; a production breakdown added seven subtasks and AI Gateway logged $0.000086                                                                                                                                                                    |
| Production    | `c685ee5` / Worker version `cb0ad7be` | `https://core.tanbase.dev`             | 2026-09-26 10:00 UTC | F-012: Workers Build `34bb2c71` post-deploy smoke passed; the 10:00 UTC cron enqueued 1 reminder, the consumer sent it, and D1 recorded `reminder_sent_at`; operator received the email                                                                                                                                                                                      |
| Production    | `8d2581d` / Worker version `cfb92e4c` | `https://core.tanbase.dev`             | 2026-09-25 22:58 UTC | Placement next to D1: Workers Build `1984aacc` post-deploy smoke passed; `cf-placement: remote-MRS`; server functions through `GIG` 24–165 ms of wall time, down from 1.7–4.3 s; board Live                                                                                                                                                                                  |
| Production    | `9712b8e` / Worker version `d97edb50` | `https://core.tanbase.dev`             | 2026-09-25 22:23 UTC | F-011 and version-aware smoke: Workers Build `adb4430f` post-deploy smoke passed on the first attempt; operator synced two devices; room held two sockets for about 42 s with 402 ms of active time                                                                                                                                                                          |
| Production    | `eb0e127` / Worker version `d7d9401f` | `https://core.tanbase.dev`             | 2026-09-25 22:10 UTC | F-011: Workers Build `4bbe27e4` deployed `BoardRoom` but its smoke reached `SIN`, still serving older versions; independent smoke passed with `realtime: ok`                                                                                                                                                                                                                 |
| DNS           | —                                     | `_mcp._agents.core.tanbase.dev`        | 2026-09-26 23:14 UTC | DNS-AID: DS for `tanbase.dev` at the `.dev` registry (key tag 2371); the SVCB record `1 core.tanbase.dev. alpn=mcp port=443 mandatory=alpn,port` answers from Cloudflare's authoritative server, with the `ad` flag from 1.1.1.1 and 8.8.8.8; isitagentready.com DNS-AID passes with `dnssecValidated: true`, level 5                                                        |
| Production D1 | `131393d`                             | `3736933e-6d18-4dbb-aba1-ccd046861b2b` | 2026-09-26           | `0000` through `0004` applied; Workers Build `becfb2d0` applied `0004`                                                                                                                                                                                                                                                                                                       |
| Production    | `dfe4f4b` / Worker version `27b14b56` | `https://core.tanbase.dev`             | 2026-09-25 21:50 UTC | F-010: Workers Build `6db0c3c8` applied migration `0002`, deployed `FILES`, and passed post-deploy smoke; health `files: ok`; unauthenticated upload `401`/`403` and download `401`; operator confirmed upload, download, and delete                                                                                                                                         |
| Production    | `fe633cf` / Worker version `1c3b3ddf` | `https://core.tanbase.dev`             | 2026-09-25 19:18 UTC | F-018 health and analytics: Workers Build `50df91c9` post-deploy smoke passed; CSP allows `https://*.posthog.com`; events sent to `eu.i.posthog.com` with no cookies or storage; operator confirmed PostHog receives events                                                                                                                                                  |
| Production    | `3fa7164` / Worker version `c38f520e` | `https://core.tanbase.dev`             | 2026-09-25 10:30 UTC | F-018 headers: Workers Build `927894c6` post-deploy smoke with header and nonce assertions passed; browser under the live CSP hydrated with zero violations                                                                                                                                                                                                                  |
| Production    | `b811368` / Worker version `0519d547` | `https://core.tanbase.dev`             | 2026-09-25 09:17 UTC | Email: Workers Build `7ab31bd3` post-deploy smoke passed; restricted `EMAIL` binding deployed. Operator-reported full auth journey passed with SPF, DKIM, and DMARC passing                                                                                                                                                                                                  |
| Production    | `3ab15ae` / Worker version `aae32e59` | `https://core.tanbase.dev`             | 2026-09-25 09:00 UTC | F-006: Workers Build `a763606d` post-deploy smoke, including token-less sign-in rejection, passed on the first attempt; independent smoke passed; forged token returned `403`; the managed widget rendered                                                                                                                                                                   |
| Production    | `0c6ea5a` / Worker version `b469d461` | `https://core.tanbase.dev`             | 2026-09-24 20:08 UTC | Canonical origin: Workers Build `fbf5f087` post-deploy smoke passed; HTTPS, apex, and `www` redirects passed                                                                                                                                                                                                                                                                 |
| Production    | `fcdee3c` / Worker version `dfc781da` | `https://tanbase-core.tanfust.com`     | 2026-09-24 19:27 UTC | Former hostname, retired later that day: full smoke passed after the secret was set                                                                                                                                                                                                                                                                                          |

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

None.

## Last known deployed commit

Production runs merge commit `c957dea` as Worker version `7df1cb2d`, deployed
by Workers Build `b927aeef` at 2026-09-27 17:45 UTC with the F-019 performance
checks and the toaster moved out of public pages. Its post-deploy smoke
passed, and a pinned smoke passed at 17:56 UTC.

The Workers Paid requirement shipped in version `3aa997d3` from `3d497fc`,
deployed by Workers Build `0dbf4209` at 17:11 UTC.

F-017 preview images (ADR-0018) shipped in version `1590a9be` from `5d055b0`,
deployed by Workers Build `48697ce9` at 16:56 UTC.

The generic top-level configuration and the Deploy to Cloudflare button
(ADR-0017) shipped in version `e83b7e10` from `b84bbfe`, deployed by Workers
Build `e09bd7f3` at 15:51 UTC. Production still deploys `env.production`.

The runtime public origin and email-optional verification (ADR-0016) shipped
in version `8f17bbc6` from `af8a708`, deployed by Workers Build `b8a6a35f` at
13:26 UTC.

The F-020 agent layer shipped in version `5a41c0ea` from `289d84c`, deployed
by Workers Build `6cb8ec5b` at 11:24 UTC.

The narrowed roadmap shipped in version `91965a6a` from `357239d`, deployed by
Workers Build `b99d9561` at 2026-09-26 23:36 UTC.

The F-016 landing page and SEO layer shipped in version `be3a85c9` from
`9204d48`, deployed by Workers Build `8e1c71dc` at 2026-09-26 22:46 UTC.

Web vitals and the superseded-build deploy guard shipped in version
`86a32108` from `a2fe387`, deployed by Workers Build `9c9ca53f` at 21:47 UTC.

Version `6db1bd46` from `023fb25` was promoted with `wrangler versions deploy`
at 21:27 UTC after a build race: PRs #26 and #27 merged 16 seconds apart, and
the build for the older `d169717` finished last, so from 21:19 to 21:27 UTC
production served version `619071df` without #27.

Agent discovery shipped in version `fd71435d` from `9e695ab`.

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
