---
status: active
audience: contributors, maintainers, product, agents
last_verified: 2026-09-24
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

**Tests**

- Workers-runtime snapshot test per template plus adapter and safe-fallback tests

---

### F-005: Auth core

**Module:** auth | **Priority:** P0 | **Status:** 🚧 In progress | **Depends on:** F-003, F-004

**What:** Email and password sign-up with verification and reset, sessions, and a protected app area.

**Acceptance criteria**

- [x] Better Auth on D1 through the Drizzle adapter; auth tables added to migrations
- [x] Server route `src/routes/api/auth/$.ts` with GET and POST handlers
- [x] `tanstackStartCookies()` is the last plugin
- [x] Sessions and verification state use authoritative D1 storage; KV is not
      used because it cannot satisfy Better Auth's atomic secondary-storage
      contract ([ADR-0006](decisions/0006-d1-auth-session-storage.md))
- [ ] Sign up, verify, sign in, sign out, forgot and reset password all work **in production**, not only locally
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

**Module:** auth | **Priority:** P0 | **Status:** 🟡 In Progress | **Depends on:** F-005

**Acceptance criteria**

- [x] Turnstile on sign-up, sign-in and forgot-password forms, verified server-side before auth runs
- [x] `AUTH_LIMITER` rate limits auth endpoints per IP
- [x] Clear UI states for a failed challenge and for a rate limit
- [ ] Production rejects token-less protected requests and the widget passes on `core.tanbase.dev`

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

**Module:** files | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-007

**Acceptance criteria**

- [ ] Attachment metadata schema and ownership constraints are added to D1 with
      this feature, not before it
- [ ] Upload from task detail, streamed through the Worker into `FILES`
- [ ] 10 MB cap and content-type allowlist enforced server-side
- [ ] Download route checks ownership before streaming the object
- [ ] Deleting an attachment, task or project deletes its R2 objects
- [ ] Object keys follow `u/{userId}/t/{taskId}/{attachmentId}`

**Technical notes**

- Streaming through the binding avoids S3 credentials. Consider presigned URLs only if files above the cap become a requirement.

**Tests**

- Download of another user's attachment is rejected
- Task deletion leaves no orphaned objects

---

## Milestone 4: Realtime

### F-011: Live board

**Module:** realtime | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-007

**Acceptance criteria**

- [ ] `BoardRoom` Durable Object per project using the WebSocket Hibernation API, with no timers
- [ ] `/api/realtime/:projectId` checks session and ownership before forwarding the upgrade
- [ ] Task mutations call `BoardRoom.broadcast()` over RPC after the D1 write succeeds
- [ ] Clients apply events to the Query cache, reconnect with backoff, and refetch after reconnecting
- [ ] Two devices see a change in under 1 second
- [ ] An idle room with an open socket hibernates (no duration growth in the dashboard)

**Technical notes**

- The Durable Object stores no app data. D1 stays the source of truth.

---

## Milestone 5: Jobs

### F-012: Due-date reminders

**Module:** jobs | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-004, F-007

**Acceptance criteria**

- [ ] Hourly cron enqueues one message per task due in the reminder window with no `reminder_sent_at`
- [ ] Queue consumer sends the reminder and sets `reminder_sent_at`
- [ ] Changing a due date clears `reminder_sent_at`
- [ ] 3 retries, then the dead-letter queue
- [ ] A duplicate message never sends a duplicate email

**Tests**

- Consumer idempotency test

---

## Milestone 6: AI

### F-013: AI Gateway and quotas

**Module:** ai | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-006

**Acceptance criteria**

- [ ] `ai_usage` schema and quota indexes are added to D1 with this feature, not
      before it
- [ ] AI Gateway created; every Workers AI call passes the gateway id
- [ ] `AI_MODEL` and `AI_GATEWAY_ID` environment variables
- [ ] Per-user daily quota in `ai_usage`, configurable, with a clear limit message
- [ ] `AI_LIMITER` blocks bursts per user
- [ ] Requests visible in the AI Gateway dashboard

**Technical notes**

- Resolve open question 3 (model choice) before planning

---

### F-014: Task breakdown workflow

**Module:** ai | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-011, F-013

**Acceptance criteria**

- [ ] "Break down" on a task checks the quota, then starts `TaskBreakdownWorkflow` with task id and user id
- [ ] Steps: load task, generate 3 to 7 subtasks as JSON, validate with Zod, insert in one batch, broadcast to the board
- [ ] Invalid model output retries the generation step, then fails cleanly with a message
- [ ] UI shows running, done and failed states; subtasks appear through realtime

**Tests**

- Validation step against malformed model output fixtures

---

## Milestone 7: MCP

### F-015: MCP server

**Module:** mcp | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-007

**Acceptance criteria**

- [ ] `/mcp` endpoint built with the Agents SDK and dispatched in `src/server.ts` before TanStack
- [ ] Tools: `list_tasks` (filter by project, status, due), `create_task`, `complete_task`
- [ ] Every tool resolves the user through the chosen auth method and goes through repositories
- [ ] Connects and works from Claude and from MCP Inspector

**Technical notes**

- Resolve open question 1 (MCP auth) before planning
- Verify the current Agents SDK API and its default Durable Object binding name

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

**Module:** platform | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-005

**Acceptance criteria**

- [ ] Security headers: CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors
- [ ] Root error boundary and 404 page
- [ ] Structured logs with a request id in Workers Logs
- [ ] PostHog loads only when `POSTHOG_KEY` is set
- [ ] `/api/health` protected or removed

**Technical notes**

- The CSP must allow `https://challenges.cloudflare.com` in `script-src` and
  `frame-src` for the Turnstile widget on the auth pages.

---

### F-019: Performance budgets

**Module:** platform | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-011, F-016

**Acceptance criteria**

- [ ] Lighthouse CI on the production build and canonical production URL
- [ ] Bundle size check for the landing page
- [ ] TTFB measured from Tunis and US East for landing and board, results recorded in `docs/PERFORMANCE.md`
- [ ] Smart Placement tested on and off, decision recorded
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
