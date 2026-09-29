---
status: active
audience: contributors, maintainers, product, agents
last_verified: 2026-09-28
---

# TanBase Core: Features

<!-- PROJECT: tanbase-core | OVERVIEW: docs/OVERVIEW.md -->
<!-- Build in the order listed under "Remaining work". A feature starts only when every dependency is ✅ Done. -->

**Status:** 🔲 Todo · 🟡 In Progress · ✅ Done · ⏸ Deferred · ⛔ Dropped
**Priority:** P0 blocks launch · P1 part of v1

## Milestones

| #   | Milestone      | Features              |
| --- | -------------- | --------------------- |
| 1   | Skeleton       | F-001, F-002          |
| 2   | Auth and tasks | F-003 to F-007        |
| 3   | Files          | F-010                 |
| 4   | Realtime       | F-011                 |
| 5   | Jobs           | F-012                 |
| 6   | AI             | F-013, F-014          |
| 7   | MCP            | F-015                 |
| 8   | Launch         | F-016 to F-024, F-027 |
| 9   | After launch   | F-022                 |
| 10  | TanStack       | F-028 to F-031        |

Deferred: F-032 and F-033, future candidates for milestone 10.
Dropped: F-008, F-009, F-025, and F-026. The task board exists to exercise
each Cloudflare primitive a real app needs, not to become a complete product,
so app-level features beyond that are left to forks.

## Remaining work

Build in this order:

1. F-023: One-click setup, waiting on the first button run and the outside
   fresh-account test
2. F-024: Public launch
3. F-022: Demo guardrails, after launch

---

## Milestone 1: Skeleton

### F-001: Worker foundation and binding skeleton

**Module:** platform | **Priority:** P0 | **Status:** ✅ Done | **Depends on:** none

**What:** Establish the runtime and deployment foundation first, then add each
binding through a product-backed vertical slice. The split preserves F-001 while
preventing unused infrastructure from entering the template.

#### F-001A: Worker foundation

**Status:** ✅ Done

**Acceptance criteria**

- [x] `pnpm dev` runs TanStack Start inside the Workers runtime
- [x] `wrangler.jsonc` uses the custom `src/server.ts` entry
- [x] Direct dependency versions and package manager are pinned
- [x] Local and production configurations have explicit `APP_ENV` values
- [x] `GET /api/health` returns the exact foundation contract without caching
- [x] Worker binding types are generated and committed
- [x] Server-only import protection is enforced and tested with a deliberate violation
- [x] Production deploy from `main` passes remote smoke

#### F-001B: Product-backed binding slices

**Status:** ✅ Done (2026-09-28)

**Acceptance criteria**

- [x] Add D1 with the first data-backed feature and verify its migration path
      locally and in production
- [x] Add KV, R2, Durable Objects, Workflows, Queues, AI, Cron, and MCP only when
      their owning product feature is implemented: R2 came with F-010, the
      Durable Object with F-011, the queue and cron with F-012, Workers AI
      and the Workflow with F-013 and F-014, and MCP with F-015. No feature
      needs KV, so it is not bound; sessions live in D1
      ([ADR-0006](decisions/0006-d1-auth-session-storage.md))
- [x] Extend health or focused diagnostics for each added binding:
      `/api/health` checks D1, R2, and the Durable Object. The queue, cron,
      Workflow, and AI serve optional features that switch off when their
      binding is missing, so each is checked by its feature's tests and
      production run instead
- [x] Verify every binding locally and in production: each feature's tests
      run against its binding locally, and [STATUS](STATUS.md) records its
      production evidence

---

### F-002: CI and production deployment

**Module:** platform | **Priority:** P0 | **Status:** ✅ Done | **Depends on:** F-001A

**What:** GitHub Actions verifies every pull request and push without deployment
credentials. Cloudflare Workers Builds owns remote deployment from `main`;
non-production branch builds are optional and disabled by default.

**Acceptance criteria**

- [x] GitHub Actions runs the repository verification command on pull requests and pushes
- [x] CI regenerates Worker types and detects drift
- [x] CI performs a production packaging dry run without deployment credentials
- [x] GitHub Actions contains no remote deployment job or Cloudflare credential reference
- [x] Cloudflare Workers Builds uses `main` as the production branch
- [x] Non-production branch builds and Preview URLs are disabled in Cloudflare
- [x] The first production build passes remote smoke checks

---

## Milestone 2: Auth and tasks

### F-003: Data layer with scoped repositories

**Module:** data | **Priority:** P0 | **Status:** ✅ Done | **Depends on:** F-001

**What:** Drizzle schema, migrations, a per-request client, and the ownership rule that replaces row-level security.

**Acceptance criteria**

- [x] Schema for `project` and `task` in `src/db/schema/`
- [x] Migrations generated into `drizzle/` and applied locally and in production
      with `wrangler d1 migrations apply`
- [x] `getDb()` creates a Drizzle client per request
- [x] Repositories take a required `userId` first argument
- [x] CI check fails if `getDb` is imported outside `src/db/` and
      `src/modules/*/repository.server.ts`
- [x] Indexes on `task(user_id, project_id, status, position)` and
      `task(due_at, reminder_sent_at)`
- [x] Idempotent seed script for local development
- [x] Health checks D1 through the real Worker binding without exposing errors

**Technical notes**

- Text IDs from `crypto.randomUUID()`, integer millisecond timestamps
- Better Auth tables arrive in F-005

**Tests**

- Workers-runtime repository tests against migrated D1 cover deterministic
  listing, constraints, cascade deletion, and cross-user reads and writes

---

### F-004: Email module

**Module:** email | **Priority:** P0 | **Status:** ✅ Done | **Depends on:** F-001

**What:** One send function, native Cloudflare delivery, and the templates every later feature needs.

**Acceptance criteria**

- [x] `sendEmail({ to, subject, template, props })` in `src/modules/email`
- [x] Optional native Cloudflare Email Service binding path with no provider
      API key; omitted from fresh-account setup until sender onboarding
- [x] React Email templates: verify email, reset password, magic link, task reminder
- [x] With no sender set, emails log safe metadata instead of sending

**Technical notes**

- Templates render at send time on the Worker. If rendering cost shows up in CPU metrics, prebuild them to HTML.
- Production sends from `noreply@send.tanbase.dev` through a binding restricted
  to that sender; the display name comes from `siteConfig.name`.

**Tests**

- Workers-runtime snapshot test per template plus adapter and safe-fallback tests

---

### F-005: Auth core

**Module:** auth | **Priority:** P0 | **Status:** ✅ Done | **Depends on:** F-003, F-004

**What:** Email and password sign-up with verification and reset, sessions, and a protected app area.

**Acceptance criteria**

- [x] Better Auth on D1 through the Drizzle adapter; auth tables added to migrations
- [x] Server route `src/routes/api/auth/$.ts` with GET and POST handlers
- [x] `tanstackStartCookies()` is the last plugin
- [x] Sessions and verification state use authoritative D1 storage; KV is not
      used because it cannot satisfy Better Auth's atomic secondary-storage
      contract ([ADR-0006](decisions/0006-d1-auth-session-storage.md))
- [x] Sign up, verify, sign in, sign out, forgot and reset password all work **in production**, not only locally
- [x] Pathless `_app` layout redirects to `/login` without a session and returns to the original URL after sign-in
- [x] A default project is created idempotently on first sign-in

**Technical notes**

- Auth instance created per request
- `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` set per environment
- Redirect values are constrained to same-origin application paths; malformed,
  absolute, and protocol-relative values fall back to `/app`
- Hanging requests have been reported with this stack; watch Workers Logs during the production check

**Tests**

- Workers-runtime coverage for sign-up, verification, sign-in, session,
  sign-out, password reset, and default-project provisioning
- Playwright happy path locally and a production smoke journey after the auth
  UI and email sender are enabled

---

### F-006: Turnstile and rate limits on auth

**Module:** auth | **Priority:** P0 | **Status:** ✅ Done | **Depends on:** F-005

**Acceptance criteria**

- [x] Turnstile on sign-up, sign-in and forgot-password forms, verified server-side before auth runs
- [x] `AUTH_LIMITER` rate limits auth endpoints per IP
- [x] Clear UI states for a failed challenge and for a rate limit
- [x] Production rejects token-less protected requests and the widget passes on `core.tanbase.dev`

**Technical notes**

- Better Auth's `captcha` plugin with the `cloudflare-turnstile` provider guards
  sign-up, sign-in, password-reset requests, and verification resends. Tokens
  are single-use and pinned to the production hostname.
- A configured `TURNSTILE_SITE_KEY` requires `TURNSTILE_SECRET_KEY`; auth fails
  closed without it. An empty site key disables the challenge.
- `AUTH_LIMITER` allows 10 requests per 60 seconds per client IP and endpoint.
  Better Auth's in-memory limiter is disabled because Worker isolates do not
  share memory, and client IPs come from `cf-connecting-ip`.
- Local development and browser tests use Cloudflare's always-pass test keys.

---

### F-007: Projects and tasks

**Module:** tasks | **Priority:** P0 | **Status:** ✅ Done | **Depends on:** F-005

**What:** The board itself.

**Acceptance criteria**

- [x] Board view per project with todo, doing and done columns
- [x] Create, edit (title, notes, due date), delete and change status of tasks
- [x] Create, rename and delete projects; deleting a project deletes its tasks
- [x] Server functions with Zod input validation, TanStack Query with optimistic updates
- [x] Empty, loading and error states

**Tests**

- Passing another user's task or project id returns not found
- Isolated local Playwright coverage exercises CRUD, refresh persistence,
  settings, password reset, sign-out, and mobile shell behavior

---

### F-008: Drag and drop ordering

**Module:** tasks | **Status:** ⛔ Dropped (2026-09-27)

App polish rather than a Cloudflare primitive. The board keeps its explicit
move controls; forks that want dragging add it.

---

### F-009: Magic link and Google sign-in

**Module:** auth | **Status:** ⛔ Dropped (2026-09-27)

Left to forks. Better Auth adds both through plugins, and the email module
already renders a magic-link template.

---

## Milestone 3: Files

### F-010: Attachments on R2

**Module:** files | **Priority:** P1 | **Status:** ✅ Done | **Depends on:** F-007

**Acceptance criteria**

- [x] Attachment metadata schema and ownership constraints are added to D1 with
      this feature, not before it
- [x] Upload from task detail, streamed through the Worker into `FILES`
- [x] 10 MB cap and content-type allowlist enforced server-side
- [x] Download route checks ownership before streaming the object
- [x] Deleting an attachment, task or project deletes its R2 objects
- [x] Object keys follow `u/{userId}/t/{taskId}/{attachmentId}`
- [x] The production bucket exists and the upload, download, and delete journey
      passes on `core.tanbase.dev`

**Technical notes**

- Streaming through the binding avoids S3 credentials. Consider presigned URLs only if files above the cap become a requirement.
- `attachment` carries `project_id` so a composite foreign key to
  `task(id, project_id, user_id)` proves ownership and cascades deletes, and so
  project deletion can find its objects.
- Uploads are raw request bodies with `Content-Length`, a type from the
  allowlist, and a URL-encoded `X-Attachment-Name`. The route requires a
  same-origin `Origin`, a session, and an owned task, and allows 20 files per
  task.
- Downloads always use `Content-Disposition: attachment`, `nosniff`, and a
  sandboxed CSP; SVG and HTML are not accepted.
- Object deletion runs after the database delete and logs failures, so a
  failure can leave an orphaned object but never a dangling attachment.
- `GET /api/health` reports `checks.files` through the real binding.

**Tests**

- Download of another user's attachment is rejected
- Task deletion leaves no orphaned objects

---

## Milestone 4: Realtime

### F-011: Live board

**Module:** realtime | **Priority:** P1 | **Status:** ✅ Done | **Depends on:** F-007

**Acceptance criteria**

- [x] `BoardRoom` Durable Object per project using the WebSocket Hibernation API, with no timers
- [x] `/api/realtime/:projectId` checks session and ownership before forwarding the upgrade
- [x] Task mutations call `BoardRoom.broadcast()` over RPC after the D1 write succeeds
- [x] Clients apply events to the Query cache, reconnect with backoff, and refetch after reconnecting
- [x] Two devices see a change in under 1 second (4 ms and 10 ms locally; operator-confirmed across two devices in production)
- [x] An idle room with an open socket hibernates (402 ms of active time while sockets stayed open for about 42 seconds)

**Technical notes**

- The Durable Object stores no app data. D1 stays the source of truth.
- Rooms are named `{userId}:{projectId}`, so a socket can only join its owner's
  room. `src/server.ts` dispatches the upgrade before TanStack Start, after
  checking the WebSocket upgrade, a same-origin `Origin`, the session, and
  project ownership.
- Heartbeats use `setWebSocketAutoResponse("ping" → "pong")`, so they never
  wake a hibernated room; clients send one every 30 seconds.
- Events are `task.upserted`, `task.deleted` (removing subtasks), and
  `project.renamed` or `project.deleted`. Updates never replace a newer cached
  copy, so a device's own echo is harmless. Creating a project sends no event.
- The CSP adds the page's own `wss:` origin to `connect-src`.
- `GET /api/health` reports `checks.realtime` through an RPC to a dedicated
  health room.

---

## Milestone 5: Jobs

### F-012: Due-date reminders

**Module:** jobs | **Priority:** P1 | **Status:** ✅ Done | **Depends on:** F-004, F-007

**Acceptance criteria**

- [x] Hourly cron enqueues one message per task due in the reminder window with no `reminder_sent_at`
- [x] Queue consumer sends the reminder and sets `reminder_sent_at`
- [x] Changing a due date clears `reminder_sent_at`
- [x] 3 retries, then the dead-letter queue
- [x] A duplicate message never sends a duplicate email
- [x] A production reminder arrives from `noreply@send.tanbase.dev` (first delivered 2026-09-26 at the 10:00 UTC run)

**Tests**

- Consumer idempotency test: duplicate messages send once, a failed send
  releases its claim and retries, and stale, finished, unverified, missing, and
  invalid messages are skipped

**Technical notes**

- The window is the next 24 hours. Due dates are calendar dates stored as
  noon in the browser's time zone, so a reminder normally arrives around noon
  the day before, and the email names the date without a time.
- Only open tasks of users with a verified email are reminded. Each cron run
  enqueues at most 1,000 reminders in batches of 100; the rest wait an hour.
- The consumer claims before sending, so delivery is at most once
  ([ADR-0012](decisions/0012-at-most-once-reminders.md)).

---

## Milestone 6: AI

### F-013: AI Gateway and quotas

**Module:** ai | **Priority:** P1 | **Status:** ✅ Done | **Depends on:** F-006

**Acceptance criteria**

- [x] `ai_usage` schema and quota indexes are added to D1 with this feature, not
      before it (migration `0003`, keyed on user and UTC day)
- [x] AI Gateway created; every Workers AI call passes the gateway id (the
      `default` gateway, created by the first call on 2026-09-26)
- [x] `AI_MODEL` and `AI_GATEWAY_ID` environment variables
- [x] Per-user daily quota in `ai_usage`, configurable, with a clear limit message
- [x] `AI_LIMITER` blocks bursts per user
- [x] Requests visible in the AI Gateway dashboard (production log on
      2026-09-26: 93 input and 97 output tokens, $0.000086)

**Technical notes**

- Open question 3 is resolved by benchmark: Mistral Small 3.1 24B through the
  `default` gateway ([ADR-0013](decisions/0013-workers-ai-model-and-gateway.md)).
- The `AI` binding is production-only, so local development and CI need no
  Cloudflare credentials; Vitest runs with `remoteBindings: false`.
- Quota reservation is one conditional upsert, so concurrent requests cannot
  exceed the limit; a run that fails without subtasks refunds its unit.

---

### F-014: Task breakdown workflow

**Module:** ai | **Priority:** P1 | **Status:** ✅ Done | **Depends on:** F-011, F-013

**Acceptance criteria**

- [x] "Break down" on a task checks the quota, then starts `TaskBreakdownWorkflow` with task id and user id
- [x] Steps: load task, generate 3 to 7 subtasks as JSON, validate with Zod, insert in one batch, broadcast to the board
- [x] Invalid model output retries the generation step, then fails cleanly with a message
- [x] UI shows running, done and failed states; subtasks appear through realtime
- [x] A production breakdown adds subtasks on `core.tanbase.dev` (seven subtasks on 2026-09-26)

**Tests**

- Validation step against malformed model output fixtures: prose, truncated
  JSON, bare arrays, wrong keys, too few or many subtasks, empty, non-string,
  and over-long titles, and duplicates
- Workflow runs through `introspectWorkflowInstance`: a mocked generation
  inserts subtasks and completes; a failing generation refunds the quota and
  errors with the user-facing message

**Technical notes**

- Only top-level tasks without subtasks can be broken down. Subtasks join the
  Todo column after its last card, show "Part of" their parent, and the parent
  shows a subtask count.
- Run IDs start with the owner's user ID, so status lookups are owner-scoped
  without storing anything.

---

## Milestone 7: MCP

### F-015: MCP server

**Module:** mcp | **Priority:** P1 | **Status:** ✅ Done | **Depends on:** F-007

**Acceptance criteria**

- [x] `/mcp` endpoint dispatched in `src/server.ts` before TanStack, built with
      the official MCP TypeScript SDK instead of the Agents SDK
      ([ADR-0014](decisions/0014-mcp-oauth-with-better-auth.md))
- [x] Tools: `list_tasks` (filter by project, status, due), `create_task`, `complete_task`
- [x] Every tool resolves the user through the chosen auth method and goes through repositories
- [x] Connects and works from Claude and from MCP Inspector (Claude connected
      to `core.tanbase.dev/mcp` on 2026-09-26; a scripted OAuth client stands
      in for MCP Inspector's flow)

**Technical notes**

- Open question 1 is resolved: OAuth 2.1 through Better Auth's MCP plugin
  with Dynamic Client Registration and audience-bound JWT access tokens.
- The Agents SDK's `McpAgent` is not used, so no Durable Object binding is
  needed.
- Tool writes publish board events, so tasks created or completed from Claude
  appear live.

---

## Milestone 8: Launch

### F-016: Landing page and SEO layer

**Module:** seo | **Priority:** P1 | **Status:** ✅ Done | **Depends on:** F-002

**Acceptance criteria**

- [x] Landing page for TanBase Core: what it is, primitive map, cost model, deploy button placeholder
- [x] `seo()` head helper: title, description, canonical, OG tags
- [x] `sitemap.xml` and environment-aware `robots.txt` routes
- [x] App routes marked noindex: indexing is opt-in, so every route except `/`
      is `noindex` without a canonical URL
- [x] JSON-LD (`SoftwareSourceCode`) on the landing page
- [x] Truthful `llms.txt` served as Markdown
- [x] Homepage canonical URL, discovery `Link` headers, and Content Signals
- [x] Markdown negotiation for the homepage, served by the Worker and
      smoke-tested on production
      ([ADR-0015](decisions/0015-worker-served-agent-discovery.md))
- [x] API catalog, AI Catalog, MCP server card, agent skills index, and
      WebMCP tools for the F-015 MCP server, smoke-tested on production
- [x] DNS-AID record published under DNSSEC by the operator

**Current slice:** Public discovery and search metadata are documented in
[Agent discovery](AGENT_DISCOVERY.md). Every document is built from the
capability it describes. auth.md, A2A, and OpenAPI stay unpublished until
those capabilities exist. The landing page copy lives in
`src/modules/seo/homepage.ts`, which also renders the homepage Markdown; the
deploy placeholder links to the guided installer until F-023 adds the
one-click button. The DNS-AID SVCB record validates under DNSSEC.

---

### F-017: OG images on the Worker

**Module:** og | **Priority:** P0 | **Status:** ✅ Done | **Depends on:** F-016

**Acceptance criteria**

- [x] `/og/:slug.png` generated on the Worker and cached: Takumi draws a
      fixed card, and Workers Caching on the `OgImage` entrypoint keeps it
      until the next deploy
      ([ADR-0018](decisions/0018-preview-images-on-the-worker.md))
- [x] Runs in production within Worker size and CPU limits: on 2026-09-27
      version `1590a9be` drew `/og/home.png` once, in 312 ms of CPU against
      Workers Paid's 30-second limit, and every later request was a cache
      `HIT`

**Technical notes**

- Takumi replaced Satori and resvg: one WebAssembly module that reads the
  site's WOFF2 font.
- **Bundle:** the upload grows from 5.8 to 9.5 MiB (3.0 MiB gzipped); the
  limit is 64 MiB.
- **Measured locally:** startup active time was 47.5 to 52.5 ms without the
  renderer and 47.7 to 55.3 ms with it, within the runs' spread. The first
  render in an isolate takes about 56 ms, and later renders about 10 ms.
- **Measured in production:** the first render took 312 ms of CPU. That is
  far over Workers Free's 10 ms, so preview images need Workers Paid.

---

### F-018: Hardening

**Module:** platform | **Priority:** P1 | **Status:** ✅ Done | **Depends on:** F-005

**Acceptance criteria**

- [x] Security headers: CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors
- [x] Root error boundary and 404 page
- [x] Structured logs with a request id in Workers Logs
- [x] PostHog loads only when `POSTHOG_KEY` is set
      ([ADR-0010](decisions/0010-privacy-first-analytics.md))
- [x] `/api/health` hardened: public, with a database check cached for 30
      seconds per location ([ADR-0009](decisions/0009-public-health-endpoint.md))

**Technical notes**

- Documents get a per-response nonce CSP. `src/server.ts` creates the nonce,
  the router stamps it on its SSR scripts, and the theme script uses
  `ScriptOnce`. Only `'self'` and `https://challenges.cloudflare.com` may serve
  scripts; Turnstile is the only allowed frame.
- The Vite dev server has no CSP; `vite build` plus `vite preview` exercises the
  enforcing policy locally.
- Static assets bypass the Worker, so `public/_headers` sets their security
  headers and immutable caching for fingerprinted `/assets/*`.
- `src/platform/log.ts` writes structured objects with the Cloudflare Ray ID as
  `requestId`, which responses also return in `X-Request-Id`.
- PostHog is bundled and dynamically imported only when the `POSTHOG_KEY`
  Worker secret exists. It runs cookieless, records page views, page leaves,
  uncaught exceptions, and Core Web Vitals, loads no remote scripts, and
  strips query strings and fragments from URLs, including those inside
  exception messages and web vitals metrics. The
  deploying Workers Build can upload browser source maps for Error Tracking
  ([ADR-0010 amendment](decisions/0010-privacy-first-analytics.md#amendment-2026-09-26)).

---

### F-019: Performance budgets

**Module:** platform | **Priority:** P0 | **Status:** ✅ Done | **Depends on:** F-011, F-016

**Acceptance criteria**

- [x] Lighthouse CI on the production build and canonical production URL: the
      CI job audits a local production build on every push, and the
      Production performance workflow audits `core.tanbase.dev` after each
      deploy
- [x] Bundle size check for the landing page: `pnpm perf:bundle` in both
- [x] TTFB measured from Tunis and US East for landing and board, results recorded in `docs/PERFORMANCE.md`:
      on 2026-09-27 the landing page's p75 was 200 ms from Tunis and 264 ms
      from US East. The board was about 540 and 620 ms, then about 336 and
      400 ms once Better Auth and the session were cached
- [x] Placement tested on and off, decision recorded ([ADR-0011](decisions/0011-placement-near-d1.md): server functions through `GIG` fell from 1.7–4.3 s to 24–165 ms)
- [x] Budgets in OVERVIEW.md met or updated with a reason: the landing
      JavaScript budget rose from 100 KB to 150 KB, since React DOM alone is
      about 65 KB; the others are met ([Performance](PERFORMANCE.md))

On 2026-09-28 no page loads full Zod any more: the forms' schemas use
`zod/mini`, and the WebMCP tools leave validation to the server. The board's
list view loads only when opened, which took the `/app` route's server chunk
from 429 KB to 181 KB
([Performance](PERFORMANCE.md#2026-09-28-launch-readiness)).

---

### F-020: Agent layer

**Module:** agent | **Priority:** P0 | **Status:** ✅ Done | **Depends on:** F-015, F-018

**Acceptance criteria**

- [x] `AGENTS.md`: stack, module map, ownership rule, binding rules, commands
- [x] `CLAUDE.md` pointing to `AGENTS.md`
- [x] Skills in `.claude/skills/`: `add-module`, `add-table`, `remove-module`, `deploy`
- [x] A fresh agent session adds a new table with CRUD using only the repo docs (run once, record the result)

**Result of the fresh-agent run (2026-09-27):** an agent with no prior
context, in its own worktree, added a user-owned `label` table in about nine
minutes: schema, generated migration, repository, Zod schemas, server
functions, query options, and 12 tests, including cross-user isolation. The
final `pnpm verify` passed with 187 Worker tests. It found five gaps, all
fixed: `db:generate` output failed the format gate, the skill did not say when
a table needs a new module, its example view mapper was undefined, tests
could not use `getDb()` and the skill did not say how to insert fixtures, and
the tasks module it cited returned whole rows to the client. The throwaway
work was not merged.

---

### F-021: Module removal

**Module:** platform | **Priority:** P0 | **Status:** ✅ Done | **Depends on:** F-010, F-012, F-014, F-015, F-020

**Acceptance criteria**

- [x] README section per optional module (files, realtime, jobs, ai, mcp) listing the folders, bindings, exports and migrations to remove
- [x] Each removal performed once on a throwaway branch with CI green
- [x] The `remove-module` skill follows the same steps

**Result (2026-09-27):** each module was removed from `main` at `1e385f6` on
its own `throwaway/remove-<module>` branch, and all four CI jobs passed on the
first push for every one. `pnpm verify`, the production dry run, and the
browser journeys also passed locally. The full lists and CI runs are in
[Module removal](MODULE_REMOVAL.md#evidence).

---

### F-022: Demo guardrails

**Module:** launch | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-024

Built after launch. Turnstile and rate limits on auth, the per-user AI quota,
and the upload cap already protect production; this adds the demo reset and
billing alerts. The operator can set the billing notifications at any time.

**Acceptance criteria**

- [ ] `demo` environment with its own resources and `DEMO_MODE=true`
- [ ] Nightly cron wipes demo users, tasks and R2 objects, only when `DEMO_MODE=true`
- [ ] Banner on the demo explaining that data resets nightly
- [ ] Cloudflare billing notifications at $6 and $10
- [ ] AI quota, upload cap and rate limits verified against the demo URL

---

### F-023: One-click setup

**Module:** launch | **Priority:** P0 | **Status:** 🟡 In Progress | **Depends on:** F-021

**Acceptance criteria**

- [ ] Deploy to Cloudflare button in the README (verify which resources it provisions automatically)
- [x] `pnpm run setup` covers migrations, generated auth secrets, D1
      provisioning, deployment, smoke checks, safe reruns, and optional-service
      deferral (`pnpm setup` itself is reserved by pnpm)
- [ ] Someone outside Tanfust with a fresh Cloudflare account reaches a working deploy in under 15 minutes using only the README

**Progress:** a deployment no longer needs personalization. The public origin
resolves at runtime, and sign-up needs verification only when email delivery
is configured ([ADR-0016](decisions/0016-deploy-without-personalization.md)).
The top level of `wrangler.jsonc` is now a generic production configuration,
and the README has the button
([ADR-0017](decisions/0017-wrangler-configuration-layout.md)). Deploying needs
Workers Paid: password sign-in and a preview image render each use over
100 ms of CPU in production, past Workers Free's 10 ms
([Deploying](DEPLOYMENT.md#workers-paid-is-required)). Next, the first real
button run confirms what it provisions, then an outside tester runs the
[fresh-account test](FRESH_ACCOUNT_TEST.md). On 2026-09-27 an outside tester
reached the setup page: it offers the D1 database, R2 bucket, and queue by
name and runs `pnpm run deploy`, and it ticks **Protect with Cloudflare
Access** by default, which the README now covers. The tester stopped before
deploying, on Workers Free.

On 2026-09-28 the README put the Deploy to Cloudflare button first. The
guided installer now places the Worker next to the new database's D1 primary
([ADR-0020](decisions/0020-installer-chooses-placement.md)), and
`pnpm run placement` does the same for a button deployment. The installer
also formats the files it rewrites before running `pnpm verify`: a renamed
resource could change where Prettier wraps a line in `wrangler.jsonc`, and
the formatting check then stopped setup.

Later on 2026-09-28 an outside tester imported the repository from the
dashboard rather than using the button. The build passed; the deploy failed
with `R2 bucket 'tanbase-core-files' not found`. R2 was not enabled, so
Wrangler skipped creating the bucket, and Workers Builds' default deploy
command, `npx wrangler deploy`, would also have skipped the D1 migrations.
`pnpm run deploy` now creates a missing database and bucket before the
migrations, or stops and says to enable R2, and the README and
[Deploying](DEPLOYMENT.md#importing-the-repository-from-the-dashboard) name
the deploy command a dashboard import needs.

Then a first deploy stopped needing any setup beyond Workers Paid
([ADR-0021](decisions/0021-deploy-binds-r2-and-creates-the-auth-secret.md)):

- R2 is optional. The top level names no bucket, and `pnpm run deploy` binds
  `<worker>-files` on each deploy while the account has R2, so attachments
  turn on once the owner enables it.
- The first deploy creates `BETTER_AUTH_SECRET`, and the button no longer
  asks for it.
- `pnpm run deploy` builds when the build command is blank, as on a dashboard
  import.
- A deployment made with `npx wrangler deploy` says on its sign-in page what
  is missing.
- The auth forms name error 1102 on Workers Free.
- The landing page offers the Deploy to Cloudflare button, which it had
  called "on the roadmap".

The tester's retry, with the deploy command set to `pnpm run deploy`, gave
the first working deploy on a fresh account: the log ended with
`Attachments: off until R2 is enabled` and `BETTER_AUTH_SECRET: created`, the
smoke suite passed against it, and sign-up, the board, and an AI breakdown
worked. The run was neither timed nor README-only, and it used a dashboard
import, so the two criteria above stay open for a clean button run. It found
one bug: the task dialog showed the raw status value, such as `doing`, which
now shows as its label.

On 2026-09-29 a button run stopped on the setup page. It asked for
`BETTER_AUTH_URL`, `EMAIL_FROM`, `TURNSTILE_SITE_KEY`, and `POSTHOG_HOST`,
whose descriptions said to leave them empty, and refused to continue while
they were. It also named the queue `tanbase-core-email`, the template's
name. The setup page now asks for nothing that can break a first deploy
([ADR-0022](decisions/0022-setup-page-asks-nothing-that-can-break.md)):

- The top level sets only the three `AI_*` variables. A Worker without
  `APP_ENV` runs as production, and each other variable is off when unset.
- `pnpm run deploy` binds the reminder queue `<worker>-email` and its
  dead-letter queue, as it binds R2.
- Variables set in the dashboard survive later deploys (`keep_vars`).
- A bare host in `BETTER_AUTH_URL` means `https://`, a value that is not a
  web address is ignored, and while it names another origin than the page's,
  the sign-in pages say where sign-in works.
- [Deploying](DEPLOYMENT.md#finishing-the-setup) lists each optional
  setting and where to set it.

---

### F-024: Public launch

**Module:** launch | **Priority:** P0 | **Status:** 🟡 In Progress | **Depends on:** F-016, F-017, F-018, F-019, F-020, F-023

**Acceptance criteria**

- [x] MIT license
- [x] README: what it is, primitive map, quick start, cost model, removing a
      module. A test keeps its primitive map and cost lists equal to the
      homepage's
- [x] Repository public and demo live: `tanfust/tanbase-core` is public and
      `https://core.tanbase.dev` is live

The launch video and posts are handled outside the repository, and are not
tracked here (2026-09-27). The launch waits on F-023's first button run and
outside fresh-account test.

---

### F-027: Branding in one config

**Module:** platform | **Priority:** P0 | **Status:** ✅ Done | **Depends on:** F-016, F-017

A fork renames the app in one file. Before F-027 the name was written out
57 times across 27 files.

**Acceptance criteria**

- [x] `src/lib/site.ts` holds the name, short name, tagline, subtitle,
      description, machine name, logo, icons, and theme color
- [x] Pages, page titles, emails, Better Auth, the preview image, the MCP
      server, the discovery documents, the agent skill, and `llms.txt` read
      it; the skill and `llms.txt` use each deployment's origin
- [x] The logo and icons in `public/` appear in the header, the favicon, the
      web manifest, and the preview image
- [x] A test fails when the app's name is written anywhere in `src/` outside
      the config
- [x] The README says how to make the app yours, and `pnpm run setup` asks
      for the name and description

---

### F-025: 30-day cost report

**Module:** launch | **Status:** ⛔ Dropped (2026-09-27)

No invoice report. The landing page and OVERVIEW state the $5 target, the
allowances it relies on, and the guardrails that keep usage inside them.

---

## Milestone 10: TanStack

Each TanStack library enters the app the way a Cloudflare primitive does:
with a real feature that uses it, tests, and docs. F-028 to F-031 shipped in
one pull request ([change record](changes/2026-09-27-tanstack-libraries.md)).

### F-028: Forms on TanStack Form

**Module:** auth, tasks | **Priority:** P1 | **Status:** ✅ Done | **Depends on:** F-005, F-007

**Acceptance criteria**

- [x] Login, sign-up, forgot-password, reset-password, both settings forms,
      the task dialog, and the project dialog use `@tanstack/react-form`
      through one app form hook, `src/components/form.tsx`
- [x] The forms validate with the same Zod schemas as the server: the task
      and project schemas are the server functions' own, and the auth
      schemas run in a Better Auth `before` hook for every client
- [x] Turnstile, redirects, OAuth continuation, and the error messages are
      unchanged; fields carry `aria-invalid` and errors linked through
      `aria-describedby`
- [x] Tests: schema and hook tests in the Workers runtime, the task dialog
      in jsdom, and a browser journey for sign-up and task validation
- [x] Verified in production on 2026-09-28, version `d6c5a2f5`

### F-029: Task list view on TanStack Table

**Module:** tasks | **Priority:** P1 | **Status:** ✅ Done | **Depends on:** F-007, F-028

**Acceptance criteria**

- [x] A List tab beside the board renders the project's tasks with
      `@tanstack/react-table` and `src/components/ui/table.tsx`
- [x] Sorting, a status filter, a search over titles and notes, and column
      visibility, stored in `/app`'s search params and validated with a
      parser that falls back per param. It was a Zod schema at first; since
      2026-09-28 it is written by hand, since route options load with every
      page and Zod cost the landing page 14 KB
- [x] The data comes from `boardQueryOptions()`; switching views never fetches
- [x] A shared link reopens the same view, which the browser journey checks
- [x] Verified in production on 2026-09-28, version `d6c5a2f5`

### F-030: Project stats on TanStack Charts

**Module:** tasks | **Priority:** P1 | **Status:** ✅ Done | **Depends on:** F-029

TanStack Charts is Alpha: 0.18.0, whose minor releases may break. It could
draw both charts, server-render them, and name them for screen readers, so it
replaced recharts, which nothing used. The version is pinned exactly.

**Acceptance criteria**

- [x] A Stats tab shows tasks created and completed per week, over eight
      UTC weeks, and tasks by status, from the board's existing data. The app
      stores no completion date, so a done task counts in the week it was
      last updated
- [x] Each chart has a descriptive name and a table of its numbers for
      screen readers; the Worker renders the SVG, and the panel loads only
      when opened
- [x] `recharts` and `src/components/ui/chart.tsx` are removed
- [x] Verified in production on 2026-09-28, version `d6c5a2f5`

### F-031: Blog on TanStack Markdown

**Module:** blog | **Priority:** P1 | **Status:** ✅ Done | **Depends on:** F-016, F-017

**Acceptance criteria**

- [x] `/blog` lists posts and `/blog/$slug` shows one, from Markdown files
      with frontmatter in `content/blog`, read at build time; no D1 table
      and no CMS ([ADR-0019](decisions/0019-blog-from-repository-markdown.md))
- [x] Meta tags, canonical URLs, sitemap entries, a preview image per post,
      and an RSS feed at `/blog/rss.xml`
- [x] Server-rendered with no Markdown code in the browser: 156 KB of
      JavaScript and a Lighthouse median of 97 on a local build
- [x] The first post, "Why TanBase Core"
- [x] Removable: [module removal](MODULE_REMOVAL.md#blog) and the
      `remove-module` skill, with the removal run once and its checks green
- [x] Verified in production on 2026-09-28, version `d6c5a2f5`

---

## Future candidates

### F-032: Live board on TanStack DB

**Module:** realtime, tasks | **Status:** ⏸ Deferred

An optimistic board whose collections sync through the `BOARD` Durable
Object. Deferred because it changes how data flows: TanStack Query and the
server functions would give way to client collections.

### F-033: AI on TanStack AI

**Module:** ai | **Status:** ⏸ Deferred

Streamed subtask suggestions, or an "ask your board" chat. Deferred until
TanStack AI supports Workers AI and AI Gateway well.

---

## Dropped from the backlog

### F-026: Daily digest

**Module:** jobs | **Status:** ⛔ Dropped (2026-09-27)

An app feature beyond the demo's role. Due-date reminders already exercise
Cron Triggers and Queues.
