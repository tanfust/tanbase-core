---
status: active
audience: contributors, maintainers, product, agents
last_verified: 2026-09-25
---

# TanBase Core: Features

<!-- PROJECT: tanbase-core | OVERVIEW: docs/OVERVIEW.md -->
<!-- Build in file order. A feature starts only when every dependency is ✅ Done. -->

**Status:** 🔲 Todo · 🟡 In Progress · ✅ Done
**Priority:** P0 blocks launch · P1 part of v1 · P2 backlog

## Milestones

| #   | Milestone      | Features       |
| --- | -------------- | -------------- |
| 1   | Skeleton       | F-001, F-002   |
| 2   | Auth and tasks | F-003 to F-009 |
| 3   | Files          | F-010          |
| 4   | Realtime       | F-011          |
| 5   | Jobs           | F-012          |
| 6   | AI             | F-013, F-014   |
| 7   | MCP            | F-015          |
| 8   | Launch         | F-016 to F-025 |
|     | Backlog        | F-026          |

---

## Milestone 1: Skeleton

### F-001: Worker foundation and binding skeleton

**Module:** platform | **Priority:** P0 | **Status:** 🟡 In Progress | **Depends on:** none

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

**Status:** 🟡 In Progress

**Acceptance criteria**

- [x] Add D1 with the first data-backed feature and verify its migration path
      locally and in production
- [ ] Add KV, R2, Durable Objects, Workflows, Queues, AI, Cron, and MCP only when
      their owning product feature is implemented
- [ ] Extend health or focused diagnostics for each added binding
- [ ] Verify every binding locally and in production

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

**Module:** tasks | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-007

**Acceptance criteria**

- [ ] Drag within and across columns; order persists after reload
- [ ] Fractional index `position` so a move writes one row
- [ ] Keyboard alternative: move up, move down, move to column

---

### F-009: Magic link and Google sign-in

**Module:** auth | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-006

**Acceptance criteria**

- [ ] Magic link sign-in through the email module
- [ ] Google OAuth sign-in
- [ ] Account linking when the Google email matches an existing verified account
- [ ] Callback URLs documented for local and production

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

**Module:** mcp | **Priority:** P1 | **Status:** 🟡 In Progress | **Depends on:** F-007

**Acceptance criteria**

- [x] `/mcp` endpoint dispatched in `src/server.ts` before TanStack, built with
      the official MCP TypeScript SDK instead of the Agents SDK
      ([ADR-0014](decisions/0014-mcp-oauth-with-better-auth.md))
- [x] Tools: `list_tasks` (filter by project, status, due), `create_task`, `complete_task`
- [x] Every tool resolves the user through the chosen auth method and goes through repositories
- [ ] Connects and works from Claude and from MCP Inspector (a scripted OAuth
      client and the browser consent flow work locally; production pending)

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

**Module:** seo | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-002

**Acceptance criteria**

- [ ] Landing page for TanBase Core: what it is, primitive map, cost model, deploy button placeholder
- [ ] `seo()` head helper: title, description, canonical, OG tags
- [x] `sitemap.xml` and environment-aware `robots.txt` routes
- [ ] App routes marked noindex
- [ ] JSON-LD (`SoftwareSourceCode`) on the landing page
- [x] Truthful `llms.txt` served as Markdown
- [x] Homepage canonical URL, discovery `Link` headers, and Content Signals
- [ ] Cloudflare Markdown for Agents enabled and smoke-tested on production

**Current slice:** Public discovery is documented in
[Agent discovery](AGENT_DISCOVERY.md). API, OAuth, MCP, skill, WebMCP, ARD, and
DNS-AID metadata remain gated on real capabilities rather than placeholder
responses.

---

### F-017: OG images on the Worker

**Module:** seo | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-016

**Acceptance criteria**

- [ ] `/og/:slug.png` generated on the Worker and cached
- [ ] Runs in production within Worker size and CPU limits

**Technical notes**

- Satori with a WASM renderer is the usual route; record the bundle size impact

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
  Worker secret exists. It runs cookieless, records page views and page leaves,
  loads no remote scripts, and strips query strings and fragments from URLs.

---

### F-019: Performance budgets

**Module:** platform | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-011, F-016

**Acceptance criteria**

- [ ] Lighthouse CI on the production build and canonical production URL
- [ ] Bundle size check for the landing page
- [ ] TTFB measured from Tunis and US East for landing and board, results recorded in `docs/PERFORMANCE.md`
- [x] Placement tested on and off, decision recorded ([ADR-0011](decisions/0011-placement-near-d1.md): server functions through `GIG` fell from 1.7–4.3 s to 24–165 ms)
- [ ] Budgets in OVERVIEW.md met or updated with a reason

---

### F-020: Agent layer

**Module:** agent | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-015, F-018

**Acceptance criteria**

- [ ] `AGENTS.md`: stack, module map, ownership rule, binding rules, commands
- [ ] `CLAUDE.md` pointing to `AGENTS.md`
- [ ] Skills in `.claude/skills/`: `add-module`, `add-table`, `remove-module`, `deploy`
- [ ] A fresh agent session adds a new table with CRUD using only the repo docs (run once, record the result)

---

### F-021: Module removal

**Module:** platform | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-010, F-012, F-014, F-015, F-020

**Acceptance criteria**

- [ ] README section per optional module (files, realtime, jobs, ai, mcp) listing the folders, bindings, exports and migrations to remove
- [ ] Each removal performed once on a throwaway branch with CI green
- [ ] The `remove-module` skill follows the same steps

---

### F-022: Demo guardrails

**Module:** launch | **Priority:** P0 | **Status:** 🔲 Todo | **Depends on:** F-010, F-012, F-014

**Acceptance criteria**

- [ ] `demo` environment with its own resources and `DEMO_MODE=true`
- [ ] Nightly cron wipes demo users, tasks and R2 objects, only when `DEMO_MODE=true`
- [ ] Banner on the demo explaining that data resets nightly
- [ ] Cloudflare billing notifications at $6 and $10
- [ ] AI quota, upload cap and rate limits verified against the demo URL

---

### F-023: One-click setup

**Module:** launch | **Priority:** P1 | **Status:** 🚧 In progress | **Depends on:** F-021

**Acceptance criteria**

- [ ] Deploy to Cloudflare button in the README (verify which resources it provisions automatically)
- [x] `pnpm run setup` covers migrations, generated auth secrets, D1
      provisioning, deployment, smoke checks, safe reruns, and optional-service
      deferral (`pnpm setup` itself is reserved by pnpm)
- [ ] Someone outside Tanfust with a fresh Cloudflare account reaches a working deploy in under 15 minutes using only the README

---

### F-024: Public launch

**Module:** launch | **Priority:** P0 | **Status:** 🔲 Todo | **Depends on:** F-016, F-018, F-020, F-022, F-023

**Acceptance criteria**

- [ ] MIT license
- [ ] README: what it is, primitive map, quick start, cost model, removing a module
- [ ] Repository public and demo live
- [ ] Launch video and posts ready

---

### F-025: 30-day cost report

**Module:** launch | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-024

**Acceptance criteria**

- [ ] After 30 days of public demo, invoice and per-product usage published in the README
- [ ] Any amount above $5 explained with the product and the cause

---

## Backlog

### F-026: Daily digest

**Module:** jobs | **Priority:** P2 | **Status:** 🔲 Todo | **Depends on:** F-012

**Acceptance criteria**

- [ ] Opt-in user setting, off by default
- [ ] Daily cron enqueues one digest per opted-in user with tasks due today and overdue
- [ ] No email when nothing is due

**Technical notes**

- Sent at a fixed UTC hour; per-user time zones are out of scope for v1

---
