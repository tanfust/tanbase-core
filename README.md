---
status: active
audience: users, contributors, maintainers, agents
last_verified: 2026-09-17
---

# TanBase Core

TanBase Core is an open-source application foundation for TanStack Start on
Cloudflare Workers. The current foundation runs server-rendered React and static
assets in the Workers runtime, with versioned branch previews, repeatable
verification, and Cloudflare-owned deployments.

The longer-term product is a working task application that demonstrates D1,
authentication, files, realtime collaboration, background work, AI, and MCP.
Those capabilities are roadmap items—not claims about the current repository.

## Quick start

Prerequisites: Node.js 22.13 or newer on a supported line, and pnpm 10.11.1.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`. In a second terminal, verify the application:

```sh
pnpm smoke -- --url http://localhost:3000 --environment local
```

Before submitting a change, run:

```sh
pnpm verify
pnpm cf:dry-run:preview
```

## Current scope

- TanStack Start SSR with an explicit server entry
- Cloudflare Workers development and deployment through the Vite plugin
- Local, preview, and production configuration targeting one Worker
- Public `GET /api/health` foundation endpoint
- Canonical sitemap, environment-aware robots policy, and truthful `llms.txt`
- Homepage discovery links and Content Signals for agent-readable resources
- CI verification, generated binding-type drift detection, and deploy dry run
- Cloudflare branch previews and automatic production deployment from `main`
- Maintained human and AI documentation

D1 and every other Cloudflare binding are intentionally deferred to later
vertical slices.

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
