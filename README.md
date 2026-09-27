---
status: active
audience: users, contributors, maintainers, agents
last_verified: 2026-09-27
---

# TanBase Core

A task board that proves the whole stack works. TanBase Core is an
open-source TanStack Start foundation for Cloudflare Workers: auth, data,
files, realtime, jobs, AI, and an MCP server in one Worker you fork and own.

[Live demo](https://core.tanbase.dev) · [Deploy your own](#quick-start) ·
[Documentation](docs/README.md)

It is not a bare template. Each Cloudflare primitive powers a real feature of
the board, runs in production on `core.tanbase.dev`, and has tests and docs.
Keep what you need and [remove the rest](#removing-a-module).

## Primitive map

Every feature runs in the same Worker, `src/server.ts`: server rendering,
static assets, the cron handler, the queue consumer, the Workflow, and the
Durable Object ship in one deploy.

| Feature                                 | Cloudflare product                         | Binding or route             |
| --------------------------------------- | ------------------------------------------ | ---------------------------- |
| Projects and tasks                      | D1 with Drizzle                            | `DB`                         |
| Accounts and sessions                   | Better Auth on D1                          | `DB`                         |
| Bot checks on sign-up and sign-in       | Turnstile                                  | `TURNSTILE_SECRET_KEY`       |
| Abuse limits on auth and AI             | Rate Limiting                              | `AUTH_LIMITER`, `AI_LIMITER` |
| Task attachments                        | R2                                         | `FILES`                      |
| Live board across devices               | Durable Objects with WebSocket Hibernation | `BOARD`                      |
| Due-date reminders                      | Cron Triggers and Queues                   | `EMAIL_QUEUE`                |
| Verification and reminder email         | Email Service                              | `EMAIL`                      |
| Task breakdown into subtasks            | Workflows                                  | `BREAKDOWN`                  |
| Subtask suggestions                     | Workers AI through AI Gateway              | `AI`                         |
| Task tools for Claude and other agents  | MCP server with OAuth 2.1                  | `/mcp`                       |
| Link preview images drawn on the Worker | Workers Caching                            | `exports.OgImage`            |
| Structured request logs                 | Workers Logs                               | `observability`              |

## Cost

The target: the public demo runs on Workers Paid at $5 a month, with its
usage inside the plan's included allowances. Static assets and egress are
free. Every deployment needs Workers Paid, because password sign-in and
drawing a preview image take more CPU per request than Workers Free allows
([why](docs/DEPLOYMENT.md#workers-paid-is-required)).

What could push it past $5:

- Workers AI beyond the free daily Neurons
- Abuse of the public demo: sign-ups, uploads, and AI calls

Guardrails running now:

- Turnstile and per-IP rate limits on auth
- A per-user daily AI quota and burst limit
- A 10 MB upload cap with a file type allowlist

The allowances each product includes are on the
[landing page](https://core.tanbase.dev/#cost-heading) and in the
[cost model](docs/OVERVIEW.md#cost-model). [Performance](docs/PERFORMANCE.md)
records the measured budgets.

## Quick start

### Deploy to Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tanfust/tanbase-core)

You need:

- A Cloudflare account on **Workers Paid**, $5 a month (upgrade under
  **Workers & Pages** in the dashboard). Signing in and drawing link preview images take
  more CPU per request than Workers Free allows.
- R2 enabled on that account (**R2 Object Storage** in the dashboard).
- A GitHub or GitLab account.

The button:

1. Copies this repository into your GitHub or GitLab account.
2. Creates the D1 database, R2 bucket, and queue.
3. Asks for `BETTER_AUTH_SECRET`: paste a random string of at least 32
   characters, such as the output of `openssl rand -base64 32`.
4. Builds and deploys with Workers Builds, and redeploys on every push.

Open the `workers.dev` URL it gives you and create an account. Until you set
up email, new accounts sign in without verifying their address; until you set
up Turnstile, sign-up has no bot challenge.
[Deploying](docs/DEPLOYMENT.md#deploy-to-cloudflare-button) covers both, and a
custom domain.

### Guided installer

Prerequisites: Node.js 22.13 or newer on a supported line, pnpm 10.11.1, and a
Cloudflare account on Workers Paid.

For a fresh clone, run the guided installer:

```sh
pnpm install --frozen-lockfile
pnpm run setup
```

It prepares local development and, after one confirmation, provisions D1,
configures Better Auth, deploys to Cloudflare, and runs production smoke checks.
Optional Email Service, custom-domain, Git-integration, and preview setup is
skipped. See [guided installation](docs/INSTALLING.md) for flags and recovery.

To prepare only local development:

```sh
pnpm install --frozen-lockfile
pnpm run setup --local-only
pnpm dev
```

Open `http://localhost:3000`. In a second terminal, verify the application:

```sh
pnpm smoke -- --url http://localhost:3000 --environment local
```

Before submitting a change, run:

```sh
pnpm verify
pnpm cf:dry-run:production
```

## Current scope

- TanStack Start SSR with an explicit server entry
- Cloudflare Workers development and deployment through the Vite plugin
- Isolated local and production configuration targeting one Worker
- D1 and Drizzle schemas for projects and tasks, with local migrations and seed data
- Ownership-scoped server repositories backed by composite database constraints
- Better Auth core with D1-backed users, sessions, accounts, and verification state
- Cloudflare Turnstile and per-IP rate limits on sign-up, sign-in, and email-sending auth requests
- Task attachments streamed into R2, with ownership checks, a 10 MB cap, a type allowlist, and cleanup on delete
- A live board: one hibernating Durable Object per project relays task changes to every open device over WebSockets
- Due-date reminders: an hourly cron enqueues due tasks and a queue consumer emails each reminder at most once
- AI task breakdown: a Workflow asks Workers AI, through AI Gateway, for 3 to 7 validated subtasks, behind a per-user daily quota and burst limit
- A remote MCP server at `/mcp`: Claude and other MCP clients sign in with OAuth 2.1 and can list, create, and complete tasks
- Typed transactional email templates with safe logging and optional Cloudflare delivery
- Resumable guided setup for local development and essential production resources
- Public `GET /api/health` endpoint with a live database check
- A landing page with the primitive map, cost model, and install commands
- Per-route SEO head tags with opt-in indexing, a canonical homepage, and `SoftwareSourceCode` JSON-LD
- Link preview images drawn on the Worker from fixed cards and kept in Workers Caching until the next deploy
- Canonical sitemap, environment-aware robots policy, and truthful `llms.txt`
- Homepage discovery links, Content Signals, and a Markdown representation for agents
- Agent discovery: an API catalog, AI Catalog, MCP server card, agent skills index, and WebMCP tools
- CI verification, generated binding-type drift detection, and deploy dry run
- Automatic production deployment from `main`; branch previews are optional
- Maintained human and AI documentation, with an agent contract in
  `AGENTS.md` and task skills in `.claude/skills/` for adding a table, adding
  or removing a module, and deploying

Local and production use separate D1 databases.

## Removing a module

`files`, `realtime`, `jobs`, `ai`, `mcp`, and `og` are optional. Each was
removed once on a throwaway branch with its checks green. The
[module removal guide](docs/MODULE_REMOVAL.md) lists every file to edit, the
cloud resources left behind, and the evidence. The `remove-module` skill in
`.claude/skills/` follows it. If the fork is already in production, deploy the
code removal before the migration that drops its data.

### files: task attachments on R2

- Folders: `src/modules/files/`, `src/routes/api/attachments/`,
  `src/routes/api/tasks/`
- Bindings: `FILES` (R2)
- Exports: none
- Migrations: drop the `attachment` table

### realtime: the live board

- Folders: `src/modules/realtime/`
- Bindings: `BOARD` (Durable Object)
- Exports: `BoardRoom` from `src/server.ts` and `test/worker.ts`
- Migrations: a `v2` Durable Object migration with
  `deleted_classes: ["BoardRoom"]`; no D1 change

### jobs: due-date reminders

- Folders: `src/modules/jobs/`
- Bindings: `EMAIL_QUEUE` (Queues) and the hourly cron; production keeps
  `"triggers": { "crons": [] }` so the deployed cron is removed
- Exports: the `scheduled` and `queue` handlers in `src/server.ts`, and
  `queue` in `test/worker.ts`
- Migrations: drop `task.reminder_sent_at` and `task_due_reminder_idx`

### ai: task breakdown

- Folders: `src/modules/ai/`
- Bindings: `AI` (Workers AI), `BREAKDOWN` (Workflow), `AI_LIMITER`, and the
  `AI_*` variables
- Exports: `TaskBreakdownWorkflow` from `src/server.ts` and `test/worker.ts`
- Migrations: drop the `ai_usage` table

### mcp: the MCP server and WebMCP

- Folders: `src/modules/mcp/`, `src/routes/oauth/`,
  `src/modules/discovery/skills/`
- Bindings: none; the Better Auth OAuth provider and three packages go with it
- Exports: none; `src/server.ts` drops its `/mcp` and OAuth discovery routing
- Migrations: drop the seven OAuth tables and `jwks`

### og: link preview images

- Folders: `src/modules/og/`
- Bindings: none; the `exports` block with `OgImage` turns off Workers
  Caching, and `@takumi-rs/wasm` goes with it
- Exports: `OgImage` from `src/server.ts` and `test/worker.ts`, and the `/og/`
  dispatch
- Migrations: none

## Documentation

- [Documentation index](docs/README.md)
- [Product and architecture](docs/OVERVIEW.md)
- [Feature roadmap](docs/FEATURES.md)
- [Current status](docs/STATUS.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Guided installation](docs/INSTALLING.md)
- [Module removal](docs/MODULE_REMOVAL.md)
- [Deployment runbook](docs/DEPLOYMENT.md)
- [AI agent contract](AGENTS.md)

## License

[MIT](LICENSE)
