---
status: accepted
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-16
---

# ADR-0001: Cloudflare Workers runtime and custom entry

## Context

TanBase Core needs one runtime architecture that supports TanStack Start SSR and
static assets now, then Queues, Cron, Durable Objects, Workflows, and MCP exports
without a deployment migration later.

## Decision

Cloudflare Workers is the application runtime. The Cloudflare Vite plugin runs
before TanStack Start. `wrangler.jsonc` points at a custom `src/server.ts` entry,
which initially delegates only `fetch` to TanStack Start. Future Worker handlers
and exported classes attach to that entry as their product slices are built.

TanStack Start explicitly enables SSR through `src/start.ts`. No data or service
binding is declared in the foundation slice.

## Consequences

Development and production use the same runtime model. The custom entry adds a
small amount of code now but prevents a later deployment-architecture change.
Cloudflare-specific implementation belongs behind server-only boundaries.

## Alternatives

The generated default entry was rejected because future Worker handlers would
require replacing the entry after deployment. Adding all planned bindings now
was rejected because unused infrastructure would be untestable and misleading.
