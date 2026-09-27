---
status: active
audience: agents, contributors, maintainers
last_verified: 2026-09-27
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
- Read the deployment's public origin through `publicOrigin()` in
  `src/platform/origin.ts`, or `getSiteOrigin()` in route heads. Never compile
  an origin into links, feeds, or auth ([ADR-0016](docs/decisions/0016-deploy-without-personalization.md)).
- Log through `src/platform/log.ts` so entries carry the request ID. Add any new
  external script, frame, or connection origin to the CSP in
  `src/platform/security-headers.ts`, and verify it with a production build.
- Update active docs with behavior changes and add one change record for each
  meaningful implementation PR. Historical change records are immutable except
  for factual corrections.
- Use the repository scripts in automation so local and CI behavior stay equal.

## Stack

| Layer      | Choice                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| Framework  | TanStack Start (React 19), TanStack Router and Query                     |
| Runtime    | One Cloudflare Worker, built with `@cloudflare/vite-plugin` and Wrangler |
| Data       | D1 through Drizzle ORM; migrations are generated SQL in `drizzle/`       |
| Auth       | Better Auth on D1, with its OAuth 2.1 provider for MCP clients           |
| UI         | Tailwind CSS v4 and shadcn/ui on Base UI                                 |
| Validation | Zod                                                                      |
| Tests      | Vitest in the Workers runtime, Vitest with jsdom for UI, Playwright      |

## Module map

| Path                  | Holds                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server.ts`       | Worker entry: routes MCP, realtime upgrades, discovery, and Markdown ahead of TanStack; cron and queue handlers; Durable Object and Workflow exports |
| `src/routes/`         | File routes. `_app` is the signed-in layout; `api/` holds server routes                                                                              |
| `src/components/`     | UI. `ui/` is shadcn/ui; feature components sit beside it                                                                                             |
| `src/db/`             | Drizzle schema, one file per table, and `getDb()`. Server-only                                                                                       |
| `src/platform/`       | Logging, request context, security headers, analytics config. Server-only                                                                            |
| `src/lib/`            | Shared utilities: site config, health checks, asset recovery                                                                                         |
| `src/modules/<name>/` | One feature per folder, below                                                                                                                        |

| Module      | Feature                                                                               | Bindings                                     |
| ----------- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| `auth`      | Better Auth, sessions, Turnstile, auth rate limits                                    | `DB`, `AUTH_LIMITER`, `TURNSTILE_SECRET_KEY` |
| `tasks`     | Projects and tasks                                                                    | `DB`                                         |
| `files`     | Task attachments                                                                      | `FILES`                                      |
| `realtime`  | Live board through the `BoardRoom` Durable Object                                     | `BOARD`                                      |
| `jobs`      | Hourly cron and reminder queue consumer                                               | `EMAIL_QUEUE`, cron trigger                  |
| `email`     | React Email templates and `sendEmail()`                                               | `EMAIL`                                      |
| `ai`        | Task breakdown Workflow, Workers AI, daily quota                                      | `AI`, `BREAKDOWN`, `AI_LIMITER`              |
| `mcp`       | `/mcp` server, OAuth discovery, WebMCP tools                                          | none; uses Better Auth                       |
| `discovery` | API catalog, AI Catalog, MCP server card, skills index                                | none                                         |
| `seo`       | `seo()` head helper, homepage copy, sitemap, robots, `llms.txt`, Markdown negotiation | none                                         |
| `analytics` | Optional PostHog configuration and URL scrubbing                                      | `POSTHOG_KEY` secret                         |

`files`, `realtime`, `jobs`, `ai`, and `mcp` are optional modules that a fork
can remove; [module removal](docs/MODULE_REMOVAL.md) lists what each takes
with it. Inside a module, files follow one convention:

| File                   | Role                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `schemas.ts`           | Zod input schemas for server functions                                                               |
| `contracts.ts`         | View types and constants shared with the UI                                                          |
| `functions.ts`         | `createServerFn` definitions that routes import; each handler imports its implementation dynamically |
| `functions.server.ts`  | Implementations: resolve the session's user, then call the repository                                |
| `repository.server.ts` | The only files besides `src/db/` that may call `getDb()`                                             |
| `queries.ts`           | TanStack Query options                                                                               |
| `*.test.ts`            | Tests in the Workers runtime against real migrations                                                 |
| `*.ui.test.tsx`        | Component tests in jsdom                                                                             |

## Ownership rule

D1 has no row-level security, so ownership lives in code. Every repository
function takes the user ID as its first argument, and every query filters by
it. A row another user owns reads as missing: `null`, an empty list, or
`false`, never an error that reveals it exists. Child tables carry `user_id`
and reference their parent through a composite foreign key that includes it,
so the database rejects a row whose owner disagrees with its parent's. Every
repository has a test that a second user cannot read, change, or delete the
first user's rows.

## Binding rules

- A binding enters only with the feature that uses it.
- Declare it in all three sections of `wrangler.jsonc`: the top level, which
  any account deploys through the Deploy to Cloudflare button, `env.local`, and
  `env.production`. Environments inherit nothing from the top level. Local
  resource names end in `-local`. Add it to `wrangler.e2e.jsonc` when the
  browser tests use it ([ADR-0017](docs/decisions/0017-wrangler-configuration-layout.md)).
- Read it from `env` in a `.server.ts` getter that returns `null` when the
  binding is absent, so an installation without it degrades instead of
  failing.
- Export Durable Object and Workflow classes from both `src/server.ts` and
  `test/worker.ts`.
- Run `pnpm cf:typegen` and commit `src/worker-configuration.d.ts`.
- Add a cached check to `/api/health` when the feature cannot work without the
  binding, and teach `pnpm run setup` to provision or defer it.

## Commands

| Command                                                        | Use                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| `pnpm dev`                                                     | Run the app in the Workers runtime on port 3000        |
| `pnpm verify`                                                  | Every gate CI runs; required before a pull request     |
| `pnpm exec vitest run <path>`                                  | One Worker test file                                   |
| `pnpm db:generate`                                             | Generate a migration from the Drizzle schema           |
| `pnpm db:migrate:local`                                        | Apply migrations to local D1                           |
| `pnpm cf:typegen`                                              | Regenerate Worker binding types                        |
| `pnpm cf:dry-run:production`                                   | Package the production configuration without deploying |
| `pnpm smoke -- --environment production --expect-version <id>` | Verify production after a deploy                       |

The [development guide](docs/DEVELOPMENT.md#commands) lists every command.

## Skills

Task runbooks live in `.claude/skills/`. Claude Code loads them by name; any
other agent can read each `SKILL.md` as a checklist.

| Skill           | Use it to                                                                |
| --------------- | ------------------------------------------------------------------------ |
| `add-table`     | Add a user-owned D1 table with a repository, server functions, and tests |
| `add-module`    | Add a feature module, with or without a new Cloudflare binding           |
| `remove-module` | Remove an optional module and its bindings, exports, and data            |
| `deploy`        | Ship a merged change and record production evidence                      |

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
authorize through Better Auth's OAuth 2.1 provider (ADR-0014). The Worker
negotiates Markdown for `/`, serves agent discovery documents built from the
MCP tool definitions, and pages offer the same tools through WebMCP
(ADR-0015). The public health endpoint includes
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
