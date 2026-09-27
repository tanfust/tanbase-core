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

The button copies this repository into your GitHub or GitLab account, creates
the D1 database, R2 bucket, and queue, then builds and deploys with Workers
Builds, and redeploys on every push. On its setup page:

- **Git:** tick **Create private Git repository** unless you want the copy to
  be public.
- **Project and resource names:** keep them or rename them. The Workflow and
  the dead-letter queue keep the names in `wrangler.jsonc`, and Workflow names
  are unique per account, so deploy one copy per account.
- **`BETTER_AUTH_SECRET`:** paste a random string of at least 32 characters,
  such as the output of `openssl rand -base64 32`. A shorter one stops sign-in.
- **Variables:** leave `BETTER_AUTH_URL`, `EMAIL_FROM`, `TURNSTILE_SITE_KEY`,
  and `POSTHOG_HOST` empty for the first deploy. A Turnstile site key without
  its secret stops sign-in.
- **Protect with Cloudflare Access:** untick it for a public app. It can put
  the whole app behind a Cloudflare sign-in, which also blocks sign-up for
  everyone else, MCP clients, and link previews.
- **Preview builds:** leave them off; the configuration turns preview URLs off.

Open the `workers.dev` URL it gives you and create an account. Then
[make it yours](#make-it-yours) in `src/lib/site.ts`. Until you set
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

## Make it yours

The app's identity lives in one file, `src/lib/site.ts`. Pages, page titles,
emails, the link preview image, the web manifest, the MCP server, the agent
discovery documents, and `llms.txt` all read it. `pnpm run setup` asks for
the name and description and writes them there, or you can edit it yourself:

| Field                        | Used for                                                               |
| ---------------------------- | ---------------------------------------------------------------------- |
| `name`, `shortName`          | Titles, the header, emails, and running text such as "New to TanBase?" |
| `tagline`, `subtitle`        | The homepage title, and the line under the name in the header          |
| `description`                | The default page description and the web manifest                      |
| `id`                         | The MCP server name, the agent skill, the health check, storage keys   |
| `logo`                       | The header mark and the preview image; see below                       |
| `icons`, `themeColor`        | The favicon, home-screen icons, the web manifest, and the browser UI   |
| `sourceRepository`, `author` | Links and structured data                                              |

Put your logo and icons in `public/`:

- `logo.svg`: the mark, drawn in the header and the preview image. Set
  `logo.monochrome` to `true` for a one-color mark: the app then draws it in
  the theme's colors, so a black mark still shows in dark mode. A PNG logo
  also works in the app, but only an SVG appears in the preview image. Set
  `logo` to `null` for the built-in check-square icon.
- `favicon.ico`, `icon.png` (96 by 96), `apple-icon.png` (180 by 180), and
  `web-app-manifest-192x192.png` and `web-app-manifest-512x512.png`.

The rest is yours to rewrite: the landing page copy in
`src/modules/seo/homepage.ts` and the product summary in
`src/modules/seo/llms.txt`. The colors are the tokens in `src/styles.css`.
Cloudflare resource names belong to `wrangler.jsonc`, which the Deploy to
Cloudflare button's setup page and `pnpm run setup` rename.

A test fails while the template's name is still written anywhere in `src/`
outside `src/lib/site.ts`. After renaming, update the email snapshots, which
include the name, with `pnpm exec vitest run src/modules/email -u`.

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
- [Performance budgets](docs/PERFORMANCE.md)
- [Fresh-account test](docs/FRESH_ACCOUNT_TEST.md)
- [AI agent contract](AGENTS.md)

## License

[MIT](LICENSE)
