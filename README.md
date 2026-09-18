---
status: active
audience: users, contributors, maintainers, agents
last_verified: 2026-09-18
---

# TanBase Core

TanBase Core is an open-source application foundation for TanStack Start on
Cloudflare Workers. The current foundation runs server-rendered React and static
assets in the Workers runtime, with repeatable verification and
Cloudflare-owned production deployments.

The repository now includes the first data-backed slice: D1, Drizzle migrations,
and ownership-scoped project and task repositories. Authentication, files,
realtime collaboration, background work, AI, and MCP remain roadmap items.

## Quick start

Prerequisites: Node.js 22.13 or newer on a supported line, and pnpm 10.11.1.

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm db:seed:local
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
- Public `GET /api/health` endpoint with a live database check
- Canonical sitemap, environment-aware robots policy, and truthful `llms.txt`
- Homepage discovery links and Content Signals for agent-readable resources
- CI verification, generated binding-type drift detection, and deploy dry run
- Automatic production deployment from `main`; branch previews are optional
- Maintained human and AI documentation

Local and production use separate D1 databases. Every later Cloudflare binding
remains deferred until its owning product feature is implemented.

## Documentation

- [Documentation index](docs/README.md)
- [Product and architecture](docs/OVERVIEW.md)
- [Feature roadmap](docs/FEATURES.md)
- [Current status](docs/STATUS.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Deployment runbook](docs/DEPLOYMENT.md)
- [AI agent contract](AGENTS.md)

## License

[MIT](LICENSE)
