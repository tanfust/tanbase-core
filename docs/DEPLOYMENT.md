---
status: active
audience: maintainers, operators, agents
last_verified: 2026-09-28
---

# Deployment runbook

Cloudflare Workers Builds owns production deployment. GitHub Actions verifies
the repository but never receives Cloudflare credentials and never deploys.

`wrangler.jsonc` has three sections
([ADR-0017](decisions/0017-wrangler-configuration-layout.md)):

- **The top level** is a production configuration any account can deploy as
  committed. The Deploy to Cloudflare button and `pnpm run deploy` use it. The
  public origin comes from each request, and email, Turnstile, and analytics
  stay off until configured ([ADR-0016](decisions/0016-deploy-without-personalization.md)).
- **`env.local`** is local development.
- **`env.production`** is a pinned installation: the TanBase demo, or yours
  after the guided installer rewrites it. Its builds select the `production`
  environment during `vite build`, because the Vite plugin emits flattened
  environment-specific configuration at build time.

There are two ways to deploy a fork:

| Path                        | What it does                                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy to Cloudflare button | Clones the repository into your GitHub or GitLab account, creates the resources, and deploys the top level with Workers Builds                       |
| `pnpm run setup`            | The resumable [guided installer](INSTALLING.md): pins `env.production` to your account, provisions resources, sets secrets, deploys, and smoke-tests |

The manual sections below remain the recovery contract.

## Workers Paid is required

Every deployment, whether from the button, the guided installer, or Workers
Builds, needs an account on Workers Paid, $5 a month. Workers Free allows
10 ms of CPU per request, and the Worker needs more than that in production:

| Request                         | CPU in production (2026-09-27) |
| ------------------------------- | ------------------------------ |
| Sign-in with a password         | 109 and 153 ms                 |
| First draw of `/og/home.png`    | 312 ms                         |
| Sign-in rejected before hashing | 6 to 10 ms                     |

On Workers Free, sign-up and sign-in are expected to fail with Cloudflare's
error 1102. Workers Paid allows 30 seconds of CPU per request by default. The
[cost model](OVERVIEW.md#cost-model) covers what the plan includes.

## Deploy to Cloudflare button

The README's button deploys the top level. Cloudflare reads `wrangler.jsonc`,
creates the resources it names, and configures Workers Builds with the
repository's `build` and `deploy` scripts. `pnpm run deploy` creates the D1
database and the R2 bucket when they are missing, applies D1 migrations,
then runs `wrangler deploy`. It stops with what to do when R2 is not
enabled on the account.

| Resource                      | Created by                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| D1 database `DB`              | The button, which records the new database ID in your copy; named `tanbase-core`, renameable on the setup page |
| R2 bucket `FILES`             | The button; R2 must be enabled on the account first; named `tanbase-core-files`, renameable                    |
| Queue `EMAIL_QUEUE`           | The button; named `tanbase-core-email`, renameable                                                             |
| Dead-letter queue             | `wrangler deploy`, which creates a missing dead-letter queue, as `tanbase-core-email-dlq`                      |
| Durable Object `BOARD`        | Deploy, from its `v1` migration                                                                                |
| Workflow `BREAKDOWN`          | Deploy, as `tanbase-core-task-breakdown`; Workflow names are unique per account                                |
| Workers AI `AI`               | Needs no resource; AI Gateway `default` is created on first use                                                |
| Rate limits, version metadata | Need no resource                                                                                               |
| `BETTER_AUTH_SECRET`          | You, when the button asks for the secrets in `.dev.vars.example`                                               |

On 2026-09-27 an outside tester reached the setup page. It showed:

- a Git connection, and **Create private Git repository**, unticked
- the project name, `tanbase-core`
- the D1 database with a location hint and read replication, off
- the R2 bucket with a location hint
- the queue
- `BETTER_AUTH_SECRET` and every variable in the top level, with the
  descriptions from the `cloudflare.bindings` field in `package.json`
- the build command `pnpm run build` and the deploy command
  `pnpm run deploy`, which is the repository's script, not pnpm's built-in
  `pnpm deploy`
- **Enable Preview builds**, and **Protect with Cloudflare Access**, ticked

The tester stopped before deploying, since the account was on Workers Free,
so the dead-letter queue, Durable Object, and Workflow rows still follow
Cloudflare's documentation. The README lists what to choose on each field.
Cloudflare Access can protect preview URLs only or all traffic, and the setup
page does not say which. If the `workers.dev` URL asks for a Cloudflare
sign-in, turn Access off in the Worker's **Access** tab for a public app.

After the first deploy:

1. Smoke-test the deployment with its own URL and the top-level configuration:

   ```sh
   pnpm smoke -- --url https://<worker>.<subdomain>.workers.dev --environment production --config default
   ```

   On an account still on Workers Free, the `/og/home.png` check fails;
   [upgrade to Workers Paid](#workers-paid-is-required).

2. Add a custom domain if you want one, then set `BETTER_AUTH_URL` to it so
   canonical URLs, cookies, and tokens use one origin.
3. Before a public launch, set up email (below) and Turnstile, so sign-up
   requires a verified address and a challenge.
4. Run the Worker next to its database: in a clone of your repository, run
   `pnpm run placement --write`, then commit and push
   ([Worker placement](#worker-placement)).

### Importing the repository from the dashboard

A copy of the repository can also be connected from the dashboard, under
**Workers & Pages → Create → Import a repository**, instead of through the
button. Workers Builds then defaults to `npx wrangler deploy` as the deploy
command, which never applies D1 migrations: the site deploys with an empty
database, and signing up fails. Before the first build:

1. Enable R2 under **R2 Object Storage**.
2. Under the Worker's **Settings → Build**, set the build command to
   `pnpm run build` and the deploy command to `pnpm run deploy`.

`pnpm run deploy` then creates the database and the bucket, and applies the
migrations before it deploys. Wrangler would create the database and the
queue during `npx wrangler deploy` too, but after the point where migrations
run, and it skips an R2 bucket without saying so when R2 is not enabled; the
deploy then fails with `R2 bucket 'tanbase-core-files' not found [code:
10085]`. Workers Builds names the Worker after the project, so a warning says
the config's `tanbase-core` does not match, and Cloudflare opens a pull
request in your copy to rename it; merging it is harmless.

On 2026-09-28 an outside tester imported the repository this way, with the
default deploy command and R2 not enabled, and hit that error.

`pnpm run deploy` refuses to run in the upstream `tanfust/tanbase-core`
checkout, where the top level would replace the TanBase demo's production
Worker. CI dry-runs the top level on every push with
`pnpm cf:dry-run:default`.

## Required Cloudflare configuration

Connect the GitHub repository to the `tanbase-core` Worker, then configure:

| Setting                      | Value                       |
| ---------------------------- | --------------------------- |
| Production branch            | `main`                      |
| Build command                | `pnpm verify`               |
| Deploy command               | `pnpm cf:deploy:production` |
| Non-production branch builds | Disabled                    |
| Root directory               | Repository root             |

Cloudflare automatically creates the Workers Builds API token. Do not add
`CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` to GitHub. The generated token
must have the minimum D1 edit permission needed by the deploy command.

PostHog Error Tracking source maps are optional. To upload them, add these
build variables to the Workers Builds configuration, under **Settings** →
**Build** → **Build variables and secrets**:

| Variable             | Value                                                                       |
| -------------------- | --------------------------------------------------------------------------- |
| `POSTHOG_API_KEY`    | Secret: a personal API key with the **Error tracking** write scope          |
| `POSTHOG_PROJECT_ID` | The PostHog project ID                                                      |
| `POSTHOG_CLI_HOST`   | The PostHog app host, such as `https://eu.posthog.com`, not the ingest host |

Only the production build of the deploy command uploads: `vite.config.ts`
requires `WORKERS_CI=1`, which Workers Builds sets, and
`CLOUDFLARE_ENV=production`. The `pnpm verify` build step, GitHub CI, and local
builds never upload, so the personal key belongs in Workers Builds alone, never
in `.env`, Wrangler variables, or Worker secrets. The upload covers the browser
bundle, then deletes the maps so they are never served. The PostHog CLI
downloads its binary from GitHub on first use and names the release from the
checkout's Git metadata. A failed upload fails the deploy; remove
`POSTHOG_API_KEY` to deploy without uploading.

Keep Preview URLs disabled. The active production `workers.dev` route is a
separate setting and may remain enabled.

### Production D1 database

Create `tanbase-core-production` in the account that owns the `tanbase-core`
Worker. Bind it as `DB` in the `production` Wrangler environment and commit its
exact database ID. Do not run a remote command while the account or ID is
unresolved.

Drizzle generates SQL under `drizzle/migrations/`, but only Wrangler applies it:

```sh
pnpm db:migrate:production
```

`pnpm cf:deploy:production` builds first, applies pending production migrations,
then deploys the generated Worker. Migrations must remain compatible with the
currently active code; destructive changes require an expand/contract rollout.

Workers Builds runs overlapping builds side by side. On 2026-09-26 two merges
16 seconds apart let the older build deploy last and roll production back. So
just before `wrangler deploy`, `scripts/deploy-if-current.mjs` compares the
build's `WORKERS_CI_COMMIT_SHA` with the tip of `main` from `git ls-remote`. A
superseded build skips the deploy and its smoke and still succeeds, since the
newer commit's build deploys both commits. Its migrations still run, and the
newer build includes them. Manual recovery runs outside Workers Builds are
never skipped, and a tip that cannot be read deploys with a warning. To put an
older version back, promote it with
`wrangler versions deploy <version-id>@100% --name tanbase-core` instead of
retrying its build.

### Worker placement

The production Worker runs next to its D1 primary rather than in the edge
location nearest each visitor
([ADR-0011](decisions/0011-placement-near-d1.md)). The primary of
`tanbase-core-production` is in `WEUR`, in Marseille, so the production
environment sets:

```jsonc
"placement": { "region": "azure:francesouth" }
```

The guided installer chooses the hint for its installation
([Placement](INSTALLING.md#placement),
[ADR-0020](decisions/0020-installer-chooses-placement.md)). For a deployment made another way,
run `pnpm run placement`. It runs one read-only query, `select 1`, against the
`DB` database of one section of `wrangler.jsonc`. It prints the primary's colo
and location hint, the recommended `placement` block, and the section it
belongs in:

```sh
# The top level, which the Deploy to Cloudflare button deploys
pnpm run placement
# env.production
pnpm run placement --env production
```

Add `--write` to write the block into that section of `wrangler.jsonc`, then
commit and push the change; the next deploy applies it. For a button
deployment, that is the repository the button created, whose Workers Build
deploys the top level. Add `--account-id <id>` when the Wrangler login can
access several accounts. The command maps the colo to a cloud region in the
same city, such as `MRS` to `azure:francesouth`, and otherwise the location
hint to one region. When it cannot read the location, it stops without
changing anything.

To find a database's primary by hand, run a read-only query through the D1
API and read `served_by_region` and `served_by_colo` from the result's `meta`
where `served_by_primary` is `true`. List the accepted region identifiers with
`GET /accounts/{account_id}/workers/placement/regions`, and choose the one
nearest the primary.

Placement moves only the Worker's `fetch` handler: static assets are still
served from the location nearest the visitor, and each Durable Object stays
where it was created. Dynamic responses then carry a `cf-placement` header
such as `remote-MRS` (forwarded to Marseille) or `local-MRS` (already there).

The hint belongs to one database. If the primary ever moves, the hint must
change: run `pnpm run placement --env production --write` again and deploy.
When the guided installer cannot read the location, it keeps the hint for the
same database and removes it for a different one, which leaves the Worker on
default placement. To remove placement, delete the key and deploy.

#### Why not Smart Placement

Since 2025-02-13, Smart Placement (`"mode": "smart"`) no longer runs Workers
next to the D1 databases they are bound to. It uses the same latency-based
logic as for any Worker, which needs consistent traffic from several
locations. At low traffic it reports `INSUFFICIENT_INVOCATIONS` and does not
move the Worker. The `host` and `hostname` options target external services,
not D1. For D1, an explicit `region` is the reliable choice.

### Production R2 bucket

Task attachments are stored in the `tanbase-core-files` bucket, bound as
`FILES` in the `production` Wrangler environment. R2 must be enabled for the
account in the Cloudflare dashboard before the bucket can exist, and the
bucket must exist before a deployment with the binding, or the deploy fails:

```sh
pnpm exec wrangler r2 bucket create tanbase-core-files
```

Objects are keyed `u/{userId}/t/{taskId}/{attachmentId}`. The Worker streams
uploads of at most 10 MB into the bucket and streams downloads back after an
ownership check; no bucket is public and no S3 credentials exist. Deleting an
attachment, task, or project deletes its objects after the database rows, and
a cleanup failure is logged as `attachment.cleanup_failed`.

`GET /api/health` reports `checks.files` by probing the bucket through the
binding, cached like the database check. Installations without the binding
report `disabled`, and the attachment UI says attachments are off.

### Durable Objects

The live board uses the `BoardRoom` Durable Object class, bound as `BOARD`.
It needs no provisioning: the `v1` migration in `wrangler.jsonc` creates the
SQLite-backed class on the first deployment that includes it. Rooms store no
application data, so a Worker rollback loses nothing, but a class that has
been deployed can only be removed with a later `deleted_classes` migration,
never by deleting its binding.

WebSocket upgrades to `/api/realtime/:projectId` bypass TanStack Start and
security-header processing, because a `101` response cannot be copied. Rooms
hibernate between events; Durable Object duration should stay near zero while
sockets are idle. `GET /api/health` reports `checks.realtime` through an RPC to
a dedicated `health` room.

### Due-date reminders

An hourly Cron Trigger (`0 * * * *`) enqueues one `EMAIL_QUEUE` message per
open task of a verified user that is due within 24 hours and has no
`reminder_sent_at`. The same Worker consumes the `tanbase-core-email` queue:
it claims each reminder in D1, sends the `taskReminder` email, and retries a
failed delivery after 120 seconds. A message that fails three retries moves to
`tanbase-core-email-dlq`, which has no consumer. Delivery is at most once
([ADR-0012](decisions/0012-at-most-once-reminders.md)).

Both queues must exist before the first deployment that binds them, or
`wrangler deploy` fails. The guided installer creates them; for this
installation they were created once with:

```sh
pnpm exec wrangler queues create tanbase-core-email
pnpm exec wrangler queues create tanbase-core-email-dlq
```

Inspect dead-lettered reminders with
`pnpm exec wrangler queues info tanbase-core-email-dlq`; each message holds
only a task ID and due time. Workers Logs record `reminders.enqueued`,
`reminders.sent`, `reminders.skipped`, and `reminders.failed` events with task
IDs, never recipients. Without `EMAIL_FROM`, reminders are logged instead of
sent and still marked as sent.

Placement does not apply to cron or queue handlers. To turn reminders off,
remove the production `queues` block and set `"triggers": { "crons": [] }`;
an empty list removes the schedule on the next deployment.

### AI task breakdown

**Break down with AI** on a top-level task without subtasks starts a
`TaskBreakdownWorkflow` run (`BREAKDOWN`, named
`tanbase-core-task-breakdown`). Before starting, the Worker checks the task,
applies `AI_LIMITER` (5 requests per 60 seconds per user), and reserves one
unit of the user's daily quota in `ai_usage` (`AI_DAILY_LIMIT`, 20 per UTC
day). The run loads the task, asks `AI_MODEL` for 3 to 7 subtasks with a JSON
Schema, validates them with Zod (two retries), inserts them in one statement,
and broadcasts them to the board. A run that ends without subtasks refunds its
quota. The board polls the run's status every two seconds.

The `AI` binding is production-only and needs no resource. Every call goes
through the AI Gateway named by `AI_GATEWAY_ID`; `default` is created by
Cloudflare on the first call, and its logs, which contain task titles and
notes, are visible under **AI > AI Gateway** in the dashboard. The model and
gateway choice is [ADR-0013](decisions/0013-workers-ai-model-and-gateway.md).
Workers Logs record `ai.breakdown_finished` and `ai.breakdown_failed` with the
run ID. Workflow runs and their steps are listed under **Workers & Pages >
Workflows**.

To turn breakdown off, remove the production `ai` binding or set
`AI_DAILY_LIMIT` to `0`; the menu item disappears and the server refuses new
runs.

### MCP server

`/mcp` is a remote MCP server with three tools: `list_tasks` (filter by
project, status, or due date), `create_task`, and `complete_task`. Better Auth
is its OAuth 2.1 authorization server
([ADR-0014](decisions/0014-mcp-oauth-with-better-auth.md)); it needs no
resource or secret beyond `BETTER_AUTH_SECRET`, and migration `0004` creates
its tables.

To connect Claude, add a custom connector with the URL
`https://core.tanbase.dev/mcp`, then sign in and select **Allow**. In Claude
Code, run `claude mcp add --transport http tanbase https://core.tanbase.dev/mcp`
and authenticate with `/mcp`. MCP Inspector works with the same URL.

A client discovers everything from the `401` challenge:
`/.well-known/oauth-protected-resource/mcp`, then
`/.well-known/oauth-authorization-server/api/auth`. It registers through
`/api/auth/oauth2/register` (Dynamic Client Registration, 10 per IP per
minute through `AUTH_LIMITER`), sends the user to `/login` and
`/oauth/consent`, and exchanges the code with PKCE. Access tokens are JWTs
for the `https://core.tanbase.dev/mcp` audience and last one hour; refresh
tokens last 30 days. `/mcp` verifies them against the public keys served at
`/api/auth/jwks`, read in-process: a Worker cannot fetch its own hostname.
Signing keys are stored encrypted with `BETTER_AUTH_SECRET`; rotating it
invalidates issued tokens.

Production smoke checks the `401` challenge and both discovery documents.
There is no screen yet to list or revoke connected clients; deleting a row
from `oauth_client` revokes that client and its tokens.

### Better Auth

`BETTER_AUTH_URL` pins the public origin. TanBase commits its own; left empty,
the Worker uses the origin each request arrives on, so a fresh deployment
works on its `workers.dev` URL. Set it once the installation has one
canonical hostname, such as a custom domain, and before enabling due-date
reminders, which run without a request ([ADR-0016](decisions/0016-deploy-without-personalization.md)).

The secret is never committed. Create a unique production secret of at least
32 characters and store it as the Worker secret `BETTER_AUTH_SECRET` in
Cloudflare. For a manual setup:

```sh
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env production
```

Do not place the secret in `wrangler.jsonc`, Workers Builds variables, source,
documentation, or logs. Better Auth stores users, accounts, sessions, and
verification records in D1. No KV namespace is required for auth; the reason is
recorded in [ADR-0006](decisions/0006-d1-auth-session-storage.md).

Apply the auth migration before deploying the code. Do not make the auth UI
public until transactional email delivery, Turnstile, and the auth rate limit
have passed their own production checks.

### Turnstile and auth rate limits

Better Auth's captcha plugin requires a Cloudflare Turnstile token on sign-up,
sign-in, password-reset requests, and verification resends. The production
`TURNSTILE_SITE_KEY` Wrangler variable is public and committed. The matching
secret is the Worker secret `TURNSTILE_SECRET_KEY`. When the site key is set and
the secret is missing, authentication fails closed; an empty site key disables
the challenge.

To enable it, create a managed widget for the canonical hostname, store its
secret, then commit the site key:

```sh
pnpm exec wrangler turnstile widget create "TanBase Core" --domain core.tanbase.dev --mode managed
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env production
```

Set the secret before deploying a commit that adds the site key. Paste the
secret only at the Wrangler prompt, never into source, documentation, or logs.
Production tokens are accepted only when Siteverify reports the canonical
hostname.

The `AUTH_LIMITER` rate-limit binding allows 10 `POST` requests per 60 seconds
per client IP and endpoint for sign-up, sign-in, password-reset requests,
password resets, and verification resends. Limited requests receive `429` with
`Retry-After: 60`. The binding needs no provisioned resource; its
`namespace_id` must be unique within the account. Counters are local to each
Cloudflare location and are designed for abuse bursts, not exact accounting.

When the production site key is set, the production smoke suite asserts that a
sign-in without a token is rejected with `MISSING_RESPONSE`.

### Transactional email

The email module sends through the native `EMAIL` binding and needs no provider
API key. Production sends from `noreply@send.tanbase.dev`, with the site name
as the display name. `send.tanbase.dev` is a dedicated Email Sending domain
whose onboarding published its `cf-bounce` MX, SPF, and DKIM records and a
`p=reject` DMARC policy. The production `send_email` binding is restricted to
that one sender through `allowed_sender_addresses`.

`EMAIL_FROM` is a bare address that must match the binding's allowed senders.
While it is empty, the module records only non-sensitive delivery metadata and
does not send. The local configuration has no `EMAIL` binding, so local
development never sends.

Email delivery also decides whether sign-up needs verification. With the
`EMAIL` binding and `EMAIL_FROM` both set, new accounts must verify their
address. Without them, new accounts sign in straight away and the reset page
says reset links cannot be emailed. Set up email before a public launch:
unverified sign-up can reveal which addresses have accounts.

The binding fails to deploy on accounts without Email Sending, so the guided
installer removes it and clears `EMAIL_FROM` unless the account has the
sender's domain onboarded and enabled. To enable email on another
installation:

1. Confirm the account is on Workers Paid; arbitrary outbound recipients are
   not available on the Free plan.
2. Onboard a sending domain in Cloudflare Email Service and confirm its SPF,
   DKIM, and DMARC records are active.
3. Add the production `send_email` binding named `EMAIL`, restricted with
   `allowed_sender_addresses` to the exact sender.
4. Set the production `EMAIL_FROM` Wrangler variable to that sender.
5. Regenerate Worker types, run verification and the production dry run, then
   deploy the same verified commit.

The authenticated operator can inspect onboarding with:

```sh
pnpm exec wrangler email sending list
pnpm exec wrangler email sending settings <domain>
```

Email Sending is a beta transactional service. Verify one delivery to an
address controlled by the operator after each sender change: sign up on the
production site with that address, confirm the verification email arrives, and
check that SPF, DKIM, and DMARC pass in the message headers. Turnstile and
`AUTH_LIMITER` must be active first so the public forms cannot be used to send
mail to arbitrary recipients. Do not use it for newsletters or bulk marketing.

### Security headers

`src/server.ts` adds security headers to every Worker response and a
`Content-Security-Policy` to HTML documents. Static assets are served before the
Worker runs, so `public/_headers` sets their headers.

| Header                                   | Value                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `Content-Security-Policy` (documents)    | Per-response nonce; scripts from `'self'` and Turnstile; `frame-ancestors 'none'` |
| `Strict-Transport-Security` (production) | `max-age=63072000; includeSubDomains`                                             |
| `X-Content-Type-Options`                 | `nosniff`                                                                         |
| `X-Frame-Options`                        | `DENY`                                                                            |
| `Referrer-Policy`                        | `strict-origin-when-cross-origin`                                                 |
| `Permissions-Policy`                     | Camera, microphone, geolocation, payment, USB, and Topics disabled                |
| `Cross-Origin-Opener-Policy`             | `same-origin`                                                                     |
| `X-Request-Id`                           | Cloudflare Ray ID, also logged as `requestId`                                     |

Every request creates a random nonce. TanStack Router stamps it on the scripts
it renders during SSR, and the theme script is rendered with `ScriptOnce` so it
carries the same nonce. Any new third-party script, frame, or connection origin
must be added to `contentSecurityPolicy()` in
`src/platform/security-headers.ts`, or browsers will block it.

The Vite dev server does not send the CSP, because its client relies on inline
code. Check the enforcing policy on a production build before deploying policy
changes:

```sh
pnpm build
pnpm exec vite preview --port 4291
```

Cloudflare Web Analytics is enabled on the `tanbase.dev` zone. Cloudflare
injects its beacon from `static.cloudflareinsights.com` into HTML responses at
the edge, copies the response's CSP nonce onto that script, and the beacon
reports to the site's own `/cdn-cgi/rum`, so the policy needs no extra origin.
It is cookieless and runs alongside the optional PostHog integration.

Production smoke fails when the document lacks the CSP or HSTS, when any
inline script lacks the CSP nonce, or when a fingerprinted asset lacks
`immutable` caching or `nosniff`. It also requires the inline asset-recovery
script: for a few seconds after a deployment, a page from the new version can
reference a fingerprinted script or stylesheet the edge does not serve yet, and
the page then reloads once (at most every 30 seconds, and never without
session storage). If a CSP change blocks resources in
production, roll back the Worker version first.

### Health endpoint

`GET /api/health` is public so smoke checks and uptime monitors need no secret
([ADR-0009](decisions/0009-public-health-endpoint.md)). A successful D1 check is
cached for 30 seconds in each Cloudflare location; failures are never cached.
Clients always receive `Cache-Control: no-store` and the same JSON contract.
Its `version` field is the running Worker version ID from the
`CF_VERSION_METADATA` binding, or `null` without the binding, so smoke can tell
which version answered. `pnpm smoke -- --environment production
--expect-version <id>` exits with status `3` while the edge serves another
version.

### Analytics

PostHog is off by default ([ADR-0010](decisions/0010-privacy-first-analytics.md)).
To enable it for this installation:

1. In the PostHog project settings, enable **Cookieless server hash mode**.
   Optionally enable **Discard client IP data**.
2. Set the production `POSTHOG_HOST` Wrangler variable to the project's
   ingestion host, such as `https://eu.i.posthog.com`, or leave it empty for
   `https://us.i.posthog.com`. A reverse-proxy origin also works.
3. Store the project API key as a Worker secret. It is public, but the secret
   keeps it out of the repository so forks never report to this project:

   ```sh
   pnpm exec wrangler secret put POSTHOG_KEY --env production
   ```

The CSP adds `https://*.posthog.com`, or the proxy origin, to `connect-src` only
while the key is set. The SDK and its exception-capture and web-vitals
extensions are bundled, so `script-src` does not change. Uncaught browser
errors arrive in PostHog Error Tracking with query strings stripped from every
URL they quote; upload source maps, as described under
[Required Cloudflare configuration](#required-cloudflare-configuration), for
readable stack traces. Core Web Vitals (LCP, INP, CLS, and FCP) arrive as
`$web_vitals` events without attribution. Session replay stays off. Delete the
secret to turn analytics off.

### Canonical production domain

The canonical origin is `https://core.tanbase.dev`
([ADR-0008](decisions/0008-canonical-production-domain.md)). It is attached to
the production Worker as a custom domain in the `tanbase.dev` zone. Cloudflare
must provision DNS and the edge certificate before the URL is available.

Keep **Always Use HTTPS** enabled on the `tanbase.dev` zone. `.dev` is
HSTS-preloaded, so browsers only use HTTPS; the edge redirect covers other
clients. Verify it independently:

```sh
curl --head http://core.tanbase.dev/
```

The response must be `301` or `308` with `Location: https://core.tanbase.dev/`.

`core.tanbase.dev` is the Worker's only custom domain. One `tanbase.dev` zone
redirect rule sends the apex and `www` to it:

| Source                                  | Target                                       | Status |
| --------------------------------------- | -------------------------------------------- | ------ |
| `tanbase.dev/*` and `www.tanbase.dev/*` | `https://core.tanbase.dev/*`, query retained | 302    |

The redirect is temporary because the apex is reserved for the TanBase brand
site. Single Redirects require proxied DNS records, so the apex and `www` use
proxied `AAAA 100::` placeholders. The former `tanbase-core.tanfust.com`
hostname was retired on 2026-09-24 by removing it from the Worker; it no longer
resolves.

Better Auth accepts requests only from `BETTER_AUTH_URL`. When the canonical
origin changes, update `siteConfig.origin` in `src/lib/site.ts` and the
production `BETTER_AUTH_URL` together, run `pnpm cf:typegen`, and redirect or
retire the former hostname immediately after that deployment, because it can no
longer sign users in. Forks keep the installer's `workers.dev` origin until they
attach their own domain.

### Markdown and agent discovery

The Worker negotiates Markdown for `/` itself and serves the agent discovery
documents, so neither depends on the zone plan
([ADR-0015](decisions/0015-worker-served-agent-discovery.md)). Leave
Cloudflare's zone-level **Markdown for Agents** off.

DNS-AID is the one discovery channel that lives in the zone: enabling DNSSEC
and adding the `_mcp._agents.core` SVCB record are dashboard steps, listed in
[Agent discovery](AGENT_DISCOVERY.md#dns-aid).

## Local gates

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm db:seed:local
pnpm verify
pnpm cf:typegen
git diff --exit-code -- src/worker-configuration.d.ts
pnpm cf:dry-run:production
pnpm smoke -- --url http://localhost:3000 --environment local
```

The dry run packages the production configuration without changing remote
state. A dry run does not prove that a remote resource or deployment works.

## Automated production flow

For a push to `main`, Workers Builds:

1. Installs dependencies and runs `pnpm verify`.
2. Builds with `CLOUDFLARE_ENV=production`.
3. Applies pending additive migrations to `tanbase-core-production`.
4. Deploys the same commit as the active production version.
5. Runs the production smoke suite against the canonical origin. Some
   Cloudflare locations keep serving the previous version for a minute or more,
   so `scripts/smoke-after-deploy.mjs` reads the new deployment's version from
   `wrangler deployments status` and waits up to three minutes for
   `/api/health` to report it. Only then do the smoke assertions run, retrying
   up to three times. A failure marks the build as failed but does not roll
   back the deployment.

Protect `main` and require successful CI and review. Do not enable a second
remote deployment workflow in GitHub Actions.

## Optional branch previews

Branch previews are not part of the default template. A team that needs them
must deliberately:

1. Enable non-production branch builds in Cloudflare Workers Builds.
2. Set the non-production command to `wrangler versions upload`.
3. Enable Preview URLs in both Cloudflare and `wrangler.jsonc`.
4. Add a dedicated Wrangler environment and separate preview resources,
   including D1, rather than connecting previews to production data.
5. Add preview-specific migration, smoke, access-control, and evidence rules.

Preview URLs are public unless protected by Cloudflare Access and are not
generated for Workers that implement Durable Objects. Revisit the entire design
before enabling previews for this roadmap.

## Manual recovery command

This command changes live Cloudflare state and is for explicit recovery only:

```sh
pnpm cf:deploy:production
```

It ends with the same post-deploy production smoke check as Workers Builds.

Environment selection belongs in the build command. Do not build once and
attempt to retarget the generated configuration during deployment.

## Production smoke checks

```sh
pnpm smoke -- --url https://core.tanbase.dev --environment production
```

For production, `--url` defaults to the canonical origin in `src/lib/site.ts`.
The script checks the database-aware health contract, SSR document, canonical
metadata, discovery headers, sitemap, robots policy, truthful `llms.txt`,
Markdown negotiation, the agent discovery documents, the blog (its index, the
newest post in the sitemap with its preview image, the RSS feed, and a 404
for a missing post), and absence of a server-error page. Record the commit, URL, UTC date, Worker version,
and result in [status](STATUS.md) and the active change record.

## Rollback and recovery

Use Cloudflare deployment rollback to restore the last healthy Worker version,
then revert the repository change. A Worker rollback does not restore D1 or any
other connected resource data.

- Build failure: reproduce with `pnpm verify` and the production dry run.
- Migration failure: do not deploy code; diagnose the additive migration and
  retry only after its state is understood.
- Production smoke failure: roll back the Worker, then repair and reverify.
- Generated-type drift: run `pnpm cf:typegen`, review, and commit the result.

References: [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/),
[build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/),
[build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
and [Preview URLs](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/).
