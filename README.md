---
status: active
audience: users, contributors, maintainers, agents
last_verified: 2026-09-27
---

# TanBase Core

TanBase Core is an open-source application foundation for TanStack Start on
Cloudflare Workers. The current foundation runs server-rendered React and static
assets in the Workers runtime, with repeatable verification and
Cloudflare-owned production deployments.

The repository now includes D1 and Drizzle, ownership-scoped project and task
repositories, Better Auth's D1 core with its authentication UI and task board,
Turnstile and rate limits on auth, task attachments on R2, a live board on
Durable Objects, due-date reminders on Cron Triggers and Queues, AI task
breakdown on Workflows and Workers AI, an MCP server, typed React Email
templates, and optional native Cloudflare Email Service delivery. The live
site at [core.tanbase.dev](https://core.tanbase.dev) maps each Cloudflare
primitive to the feature it powers and shows the cost model.

## Quick start

Prerequisites: Node.js 22.13 or newer on a supported line, and pnpm 10.11.1.

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
- Canonical sitemap, environment-aware robots policy, and truthful `llms.txt`
- Homepage discovery links, Content Signals, and a Markdown representation for agents
- Agent discovery: an API catalog, AI Catalog, MCP server card, agent skills index, and WebMCP tools
- CI verification, generated binding-type drift detection, and deploy dry run
- Automatic production deployment from `main`; branch previews are optional
- Maintained human and AI documentation, with an agent contract in
  `AGENTS.md` and task skills in `.claude/skills/` for adding a table, adding
  or removing a module, and deploying

Local and production use separate D1 databases. Every later Cloudflare binding
remains deferred until its owning product feature is implemented.

## Documentation

- [Documentation index](docs/README.md)
- [Product and architecture](docs/OVERVIEW.md)
- [Feature roadmap](docs/FEATURES.md)
- [Current status](docs/STATUS.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Guided installation](docs/INSTALLING.md)
- [Deployment runbook](docs/DEPLOYMENT.md)
- [AI agent contract](AGENTS.md)

## License

[MIT](LICENSE)
