---
status: active
audience: agents, contributors, maintainers
last_verified: 2026-09-25
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

- Preserve the distinction between local verification and production
  deployment. Never infer deployment from a local build or dry run.
- Run `pnpm verify` for implementation changes. Run the relevant Cloudflare dry
  run for deployment changes.
- Regenerate `src/worker-configuration.d.ts` with `pnpm cf:typegen` whenever
  `wrangler.jsonc` bindings or variables change. Do not hand-edit it.
- Keep route-importable RPC modules unsuffixed. Put database, platform, binding,
  and secret implementations in `.server.ts` files or protected directories.
- Do not add Cloudflare bindings without a product feature that exercises them
  and a documented local/remote verification path.
- Never store credentials in source, generated output, docs, fixtures, or logs.
- Log through `src/platform/log.ts` so entries carry the request ID. Add any new
  external script, frame, or connection origin to the CSP in
  `src/platform/security-headers.ts`, and verify it with a production build.
- Update active docs with behavior changes and add one change record for each
  meaningful implementation PR. Historical change records are immutable except
  for factual corrections.
- Use the repository scripts in automation so local and CI behavior stay equal.

## Foundation boundaries

The current milestone includes Worker SSR, static assets, local and production
environments, observability, deployment automation, and D1-backed project/task
repositories. The server-only email module renders typed React Email templates,
logs safe metadata when no sender is configured, and can send through an
explicitly enabled native Cloudflare Email Service binding without an API key.
Better Auth uses
request-scoped D1 storage for users, accounts, sessions, and verification state;
KV is intentionally not configured for auth. Turnstile and the `AUTH_LIMITER`
rate-limit binding protect credential and email-sending auth endpoints. Task attachments use the `FILES` R2 bucket, and the `BOARD` Durable Object
relays live board events without storing data. An hourly cron enqueues due-date
reminders on `EMAIL_QUEUE`, which the same Worker consumes at most once
(ADR-0012). `TaskBreakdownWorkflow` (`BREAKDOWN`) breaks tasks into subtasks
with Workers AI through AI Gateway, behind a daily quota in `ai_usage` and
`AI_LIMITER`; the `AI` binding exists only in production (ADR-0013). `/mcp`
serves `list_tasks`, `create_task`, and `complete_task` to MCP clients that
authorize through Better Auth's OAuth 2.1 provider (ADR-0014). The public
health endpoint includes
a D1 check cached for 30 seconds per location (ADR-0009). PostHog analytics is
optional and loads only when the `POSTHOG_KEY` Worker secret is set (ADR-0010).
Production runs next to its D1 primary through a placement hint that belongs to
that database (ADR-0011).

The guided installer owns clone personalization and essential Cloudflare setup.
It must remain resumable, must never persist production secrets, and must keep
optional bindings out of the default path.

## Definition of done

Code, tests, docs, generated types, and the change record agree. Record the exact
commands run and their result. Deployment is complete only when the target URL
has passed `pnpm smoke` and the evidence has been added to the status snapshot.
