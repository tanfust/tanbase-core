---
status: active
audience: contributors, maintainers, product, agents
last_verified: 2026-09-16
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
|     | Backlog        | F-026, F-027   |

---

## Milestone 1: Skeleton

### F-001: Worker foundation and binding skeleton

**Module:** platform | **Priority:** P0 | **Status:** 🟡 In Progress | **Depends on:** none

**What:** Establish the runtime and deployment foundation first, then add each
binding through a product-backed vertical slice. The split preserves F-001 while
preventing unused infrastructure from entering the template.

#### F-001A: Worker foundation

**Status:** 🟡 In Progress

**Acceptance criteria**

- [x] `pnpm dev` runs TanStack Start inside the Workers runtime
- [x] `wrangler.jsonc` uses the custom `src/server.ts` entry
- [x] Direct dependency versions and package manager are pinned
- [x] Local, preview, and production environments have explicit names and `APP_ENV`
- [x] `GET /api/health` returns the exact foundation contract without caching
- [x] Worker binding types are generated and committed
- [x] Server-only import protection is enforced and tested with a deliberate violation
- [ ] Preview deploy and remote smoke test succeed
- [ ] Production deploy of the same commit passes manual approval and remote smoke

#### F-001B: Product-backed binding slices

**Status:** 🔲 Todo

**Acceptance criteria**

- [ ] Add D1 with the first data-backed feature and migration path
- [ ] Add KV, R2, Durable Objects, Workflows, Queues, AI, Cron, and MCP only when
      their owning product feature is implemented
- [ ] Extend health or focused diagnostics for each added binding
- [ ] Verify every binding locally, in preview, and in production

---

### F-002: CI and preview-first deployment

**Module:** platform | **Priority:** P0 | **Status:** 🟡 In Progress | **Depends on:** F-001A

**What:** Every pull request and push gets verification and a Cloudflare dry run.
`main` deploys the isolated preview Worker, smokes it, then waits for protected
production approval before rebuilding and deploying the same commit.

**Acceptance criteria**

- [x] GitHub Actions runs the repository verification command on pull requests and pushes
- [x] CI regenerates Worker types and detects drift
- [x] CI performs a preview deployment dry run without deployment credentials
- [x] A push to `main` deploys and smokes preview before production can start
- [x] Production uses a protected GitHub environment and checks out the same commit
- [ ] GitHub `preview` and protected `production` environments are configured
- [ ] The first preview and production workflow run succeeds

---

## Milestone 2: Auth and tasks

### F-003: Data layer with scoped repositories

**Module:** data | **Priority:** P0 | **Status:** 🔲 Todo | **Depends on:** F-001

**What:** Drizzle schema, migrations, a per-request client, and the ownership rule that replaces row-level security.

**Acceptance criteria**

- [ ] Schema for `project`, `task`, `attachment`, `ai_usage` in `src/db/schema/`
- [ ] Migrations generated into `drizzle/` and applied locally and remotely with `wrangler d1 migrations apply`
- [ ] `getDb()` creates a Drizzle client per request
- [ ] Repositories take a required `userId` first argument
- [ ] CI check fails if `getDb` is imported outside `src/db/` and `src/modules/*/repository.ts`
- [ ] Indexes on `task(user_id, project_id, status, position)` and `task(due_at, reminder_sent_at)`
- [ ] Seed script for local development

**Technical notes**

- Text IDs from `crypto.randomUUID()`, integer millisecond timestamps
- Better Auth tables arrive in F-005

**Tests**

- Repository tests against local D1, including a cross-user read that must return nothing

---

### F-004: Email module

**Module:** email | **Priority:** P0 | **Status:** 🔲 Todo | **Depends on:** F-001

**What:** One send function, a Resend adapter, and the templates every later feature needs.

**Acceptance criteria**

- [ ] `sendEmail({ to, subject, template, props })` in `src/modules/email`
- [ ] Resend adapter selected by `EMAIL_PROVIDER=resend`
- [ ] React Email templates: verify email, reset password, magic link, task reminder
- [ ] With no API key set, emails are logged instead of sent

**Technical notes**

- Templates render at send time on the Worker. If rendering cost shows up in CPU metrics, prebuild them to HTML.

**Tests**

- Snapshot test per template

---

### F-005: Auth core

**Module:** auth | **Priority:** P0 | **Status:** 🔲 Todo | **Depends on:** F-003, F-004

**What:** Email and password sign-up with verification and reset, sessions, and a protected app area.

**Acceptance criteria**

- [ ] Better Auth on D1 through the Drizzle adapter; auth tables added to migrations
- [ ] Server route `src/routes/api/auth/$.ts` with GET and POST handlers
- [ ] `tanstackStartCookies()` is the last plugin
- [ ] KV configured as session secondary storage
- [ ] Sign up, verify, sign in, sign out, forgot and reset password all work **in production**, not only locally
- [ ] Pathless `_app` layout redirects to `/login` without a session and returns to the original URL after sign-in
- [ ] A default project is created on first sign-in

**Technical notes**

- Auth instance created per request
- `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` set per environment
- Hanging requests have been reported with this stack; watch Workers Logs during the production check

**Tests**

- Playwright happy path against a preview URL

---

### F-006: Turnstile and rate limits on auth

**Module:** auth | **Priority:** P0 | **Status:** 🔲 Todo | **Depends on:** F-005

**Acceptance criteria**

- [ ] Turnstile on sign-up, sign-in and forgot-password forms, verified server-side before auth runs
- [ ] `AUTH_LIMITER` rate limits auth endpoints per IP
- [ ] Clear UI states for a failed challenge and for a rate limit

**Technical notes**

- Use Better Auth's captcha plugin if it supports Turnstile; otherwise verify in the auth route
- Turnstile test keys in local dev

---

### F-007: Projects and tasks

**Module:** tasks | **Priority:** P0 | **Status:** 🔲 Todo | **Depends on:** F-005

**What:** The board itself.

**Acceptance criteria**

- [ ] Board view per project with todo, doing and done columns
- [ ] Create, edit (title, notes, due date), delete and change status of tasks
- [ ] Create, rename and delete projects; deleting a project deletes its tasks
- [ ] Server functions with Zod input validation, TanStack Query with optimistic updates
- [ ] Empty, loading and error states

**Tests**

- Passing another user's task or project id returns not found

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
- [ ] Callback URLs documented for local, preview and production

---

## Milestone 3: Files

### F-010: Attachments on R2

**Module:** files | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-007

**Acceptance criteria**

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
- [ ] `sitemap.xml` and `robots.txt` routes; app routes marked noindex
- [ ] JSON-LD (`SoftwareSourceCode`) on the landing page
- [ ] `llms.txt`

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

---

### F-019: Performance budgets

**Module:** platform | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-011, F-016

**Acceptance criteria**

- [ ] Lighthouse CI on the landing page against each preview
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

**Module:** launch | **Priority:** P1 | **Status:** 🔲 Todo | **Depends on:** F-021

**Acceptance criteria**

- [ ] Deploy to Cloudflare button in the README (verify which resources it provisions automatically)
- [ ] `pnpm setup` covers whatever the button does not: migrations, secrets checklist
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

### F-027: Cloudflare Email Service adapter

**Module:** email | **Priority:** P2 | **Status:** 🔲 Todo | **Depends on:** F-004

**Acceptance criteria**

- [ ] `cloudflare` adapter using the Email Service binding, selected by `EMAIL_PROVIDER=cloudflare`
- [ ] Marked as beta in docs until Cloudflare announces general availability
- [ ] Template snapshot tests pass with both adapters
