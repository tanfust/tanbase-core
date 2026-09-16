---
status: active
audience: agents, contributors, maintainers
last_verified: 2026-09-16
---

# AI agent operating contract

Read, in order:

1. This file.
2. [Current status](docs/STATUS.md).
3. The relevant active guide: [development](docs/DEVELOPMENT.md),
   [deployment](docs/DEPLOYMENT.md), or [architecture](docs/OVERVIEW.md).
4. The relevant [feature](docs/FEATURES.md) and accepted
   [decision record](docs/decisions/README.md).
5. Historical [change notes](docs/changes/README.md) only when history matters.

## Source hierarchy

When sources disagree, use this order:

1. Current code and configuration.
2. Active architecture and runbooks.
3. Accepted ADRs that have not been superseded.
4. Historical change notes.

A change note records what was true at a point in time. Never treat an old
change note as current truth. A superseded ADR must link to its replacement.

## Required working practices

- Preserve the distinction between local verification, preview deployment, and
  production deployment. Never infer deployment from a local build or dry run.
- Run `pnpm verify` for implementation changes. Run the relevant Cloudflare dry
  run for deployment changes.
- Regenerate `src/worker-configuration.d.ts` with `pnpm cf:typegen` whenever
  `wrangler.jsonc` bindings or variables change. Do not hand-edit it.
- Keep route-importable RPC modules unsuffixed. Put database, platform, binding,
  and secret implementations in `.server.ts` files or protected directories.
- Do not add Cloudflare bindings without a product feature that exercises them
  and a documented local/remote verification path.
- Never store credentials in source, generated output, docs, fixtures, or logs.
- Update active docs with behavior changes and add one change record for each
  meaningful implementation PR. Historical change records are immutable except
  for factual corrections.
- Use the repository scripts in automation so local and CI behavior stay equal.

## Foundation boundaries

The current milestone includes Worker SSR, static assets, environments,
observability, health checks, and deployment automation. D1, KV, R2, Queues,
Workflows, Durable Objects, AI, and MCP are not configured yet. The public health
endpoint is temporary and will be reduced or protected during hardening.

## Definition of done

Code, tests, docs, generated types, and the change record agree. Record the exact
commands run and their result. Deployment is complete only when the target URL
has passed `pnpm smoke` and the evidence has been added to the status snapshot.
