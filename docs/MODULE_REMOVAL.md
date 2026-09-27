---
status: active
audience: users, contributors, agents
last_verified: 2026-09-27
---

# Removing optional modules

`files`, `realtime`, `jobs`, `ai`, and `mcp` are optional. Each removal below
was performed once, from `main` at `1e385f6`, on a throwaway branch whose CI
passed; see [Evidence](#evidence). The
[`remove-module` skill](../.claude/skills/remove-module/SKILL.md) follows
these lists. The [README](../README.md#removing-a-module) summarizes them.

## Before you start

- **Deploy the removal in two steps if the fork is already in production.**
  Workers Builds applies D1 migrations before it deploys the new code, so for
  a few seconds the old Worker runs against the new schema. Ship the code
  removal first. Ship the migration that drops the module's tables or
  columns in a later deploy. A Worker rollback after the drop needs a
  migration that recreates what it dropped.
- **Edit all three Wrangler configurations:** the base configuration for local
  development, `env.production`, and `wrangler.e2e.jsonc` for the browser
  tests. CI does not run the browser tests, so a stale e2e configuration
  stays green in CI and breaks `pnpm test:e2e`.
- **Regenerate the route tree** after deleting a route: `pnpm build` or
  `pnpm dev` rewrites `src/routeTree.gen.ts`. Until then `pnpm typecheck`
  fails.
- **Search beyond the module name.** Typecheck finds callers, but not helpers
  in other modules that only the removed module used, tests that assert
  public copy, comments, or configuration. Each section lists what the trial
  found.
- **Removing several modules** combines the lists. Where one module calls
  another, the sections say so.

After removing, run:

```sh
pnpm verify
pnpm cf:dry-run:production
pnpm test:e2e
```

## files

Task attachments on R2.

| What              | Remove                                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Folders and files | `src/modules/files/`, `src/routes/api/attachments/`, `src/routes/api/tasks/`, `src/components/board/task-attachments.tsx`, `src/db/schema/attachments.ts` |
| Bindings          | `r2_buckets` with `FILES` in the base configuration, `env.production`, and `wrangler.e2e.jsonc`                                                           |
| Exports           | None                                                                                                                                                      |
| Migration         | Drops the `attachment` table and its indexes                                                                                                              |
| Packages          | None                                                                                                                                                      |

Edit:

- `src/modules/tasks/functions.server.ts`: deleting a task or project no
  longer collects and deletes R2 keys. The database cascade is unchanged.
- `src/components/board/task-dialog.tsx`: the attachments section.
- `src/db/schema/index.ts`: the `attachments` export.
- `src/lib/health.ts`, `src/lib/health.test.ts`, `src/routes/api/health.ts`:
  the `files` check. The health response becomes
  `checks: { database, realtime }`.
- `scripts/smoke.mjs`: the `files` health assertion.
- `scripts/setup.mjs`, `scripts/setup/core.mjs`, `scripts/setup/core.test.mjs`:
  the R2 bucket step, its state key, and its tests.
- `e2e/app.spec.ts`: the upload, download, and delete journey.
- Public copy in `src/modules/seo/homepage.ts` (summary, R2 allowance, primitive
  row, upload risk and guardrail, installer line) and `src/modules/seo/llms.txt`.
- Docs: `README.md`, `AGENTS.md`, `docs/OVERVIEW.md`, `docs/DEVELOPMENT.md`,
  `docs/DEPLOYMENT.md`, `docs/INSTALLING.md`, `docs/FEATURES.md`.
- Skills: `add-module` and `add-table` use `files` as an example.

Delete by hand: the R2 bucket `<worker-name>-files`, after emptying it.

The generic `src/components/ui/attachment.tsx` is unused shadcn/ui and can
stay.

## realtime

The live board through the `BoardRoom` Durable Object.

| What              | Remove                                                                                                                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Folders and files | `src/modules/realtime/`                                                                                                                                                                                                                             |
| Bindings          | `durable_objects` with `BOARD` in the base configuration and `env.production`, then add `{ "tag": "v2", "deleted_classes": ["BoardRoom"] }` after `v1` in both. `wrangler.e2e.jsonc` is never deployed, so drop its binding and `v1` entry outright |
| Exports           | `BoardRoom` from `src/server.ts` and `test/worker.ts`                                                                                                                                                                                               |
| Migration         | No D1 migration. The `v2` Durable Object migration deletes every `BoardRoom` object on the first deploy that carries it                                                                                                                             |
| Packages          | None                                                                                                                                                                                                                                                |

Edit:

- `src/server.ts`: the `/api/realtime/:projectId` dispatch, and the page's
  own `ws:` or `wss:` origin that it adds to the CSP `connect-src`. The
  pass-through for `101` responses can stay.
- `src/modules/tasks/functions.server.ts`, and `mcp` and `ai` if they stay:
  every `publishBoardEvent` call, the task read before delete that only named
  the event's project, the MCP `toTaskView` helper, and the Workflow's
  broadcast step.
- `src/components/board/board-page.tsx`: the Live indicator and the handling
  of other devices' changes. Keep the create de-duplication.
- WebMCP, if `mcp` stays: its writes reached the board only through the socket
  echo, so `src/modules/mcp/web-mcp.ts`, `src/components/web-mcp.tsx`, and
  `src/routes/__root.tsx` refetch the board after `create_task` and
  `complete_task`. Nothing fails to compile without this; the browser test
  fails.
- `src/lib/health.ts`, `src/lib/health.test.ts`, `src/routes/api/health.ts`,
  and `scripts/smoke.mjs`: the `realtime` check.
- `e2e/app.spec.ts`: the two-device test.
- Copy that says tasks appear live: `src/modules/mcp/tool-definitions.ts`,
  which feeds `tools/list`, the server card, and WebMCP, and
  `src/modules/discovery/skills/tanbase-tasks/SKILL.md`.
- Public copy in `src/modules/seo/homepage.ts` (live-board row, Durable
  Objects allowance, Worker card) and `src/modules/seo/llms.txt`.
- Docs: `README.md`, `AGENTS.md`, `docs/OVERVIEW.md` (primitive map, budgets,
  cost model), `docs/DEVELOPMENT.md`, `docs/DEPLOYMENT.md`, `docs/INSTALLING.md`,
  `docs/FEATURES.md`.
- Skills: `add-module` uses `realtime` as its Durable Object example.

Delete by hand: nothing. Cloudflare refuses a rollback across the class
deletion, so bringing the board back means restoring the module under a new
migration tag.

The new health response has no `realtime` key, so the new smoke fails against
a version that still has one; the post-deploy smoke waits for the new version
first. Without live updates the board still refetches on focus and after its
own changes. A TanStack Query `refetchInterval` gives near-live updates with no
Durable Object.

## jobs

Due-date reminders: an hourly Cron Trigger, the `EMAIL_QUEUE` queue and its
consumer.

| What              | Remove                                                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Folders and files | `src/modules/jobs/`                                                                                                                                                                            |
| Bindings          | `queues` (producer, consumer, dead-letter queue) and `triggers` in the base configuration and `wrangler.e2e.jsonc`. In `env.production`, remove `queues` and set `"triggers": { "crons": [] }` |
| Exports           | The `scheduled` and `queue` handlers in `src/server.ts`, and the `queue` handler in `test/worker.ts`                                                                                           |
| Migration         | Drops the `task_due_reminder_idx` index and the `task.reminder_sent_at` column                                                                                                                 |
| Packages          | None                                                                                                                                                                                           |

A deployed Cron Trigger stays in place when `triggers` is simply missing, so
production needs the empty list. The column drop runs without rebuilding
`task`, so nothing cascades.

Edit:

- `src/db/schema/tasks.ts`, `src/modules/tasks/repository.server.ts` and its
  test: the `reminderSentAt` column and the code that sets and clears it.
- `src/modules/ai/repository.server.ts`, if `ai` stays: its subtask insert sets
  `reminderSentAt`.
- `src/modules/email/`: the `taskReminder` template, its type, render case,
  test, and snapshot.
- `scripts/seed.sql`: the `reminder_sent_at` column.
- `scripts/setup.mjs`, `scripts/setup/core.mjs`, `scripts/setup/core.test.mjs`:
  the queue step, its state key, and its tests.
- Public copy in `src/modules/seo/homepage.ts` (summary, Worker card, reminders
  row, Queues allowance, email row, installer line) and
  `src/modules/seo/llms.txt`.
- Docs: `README.md`, `AGENTS.md`, `docs/OVERVIEW.md`, `docs/DEPLOYMENT.md`,
  `docs/INSTALLING.md`, `docs/FEATURES.md`, and
  [ADR-0012](decisions/0012-at-most-once-reminders.md), which becomes
  superseded.
- Skills: `add-module` uses `jobs` as an example.

Delete by hand: the queues `<worker-name>-email` and `<worker-name>-email-dlq`
with `wrangler queues delete`, after the new version is live. Inspect the
dead-letter queue first if its messages matter.

Due dates stay as plain task data.

## ai

AI task breakdown: the `TaskBreakdownWorkflow` Workflow, Workers AI through AI
Gateway, the `AI_LIMITER` burst limit, and the `ai_usage` daily quota.

| What              | Remove                                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Folders and files | `src/modules/ai/`, `src/db/schema/ai-usage.ts`                                                                                                                                                                           |
| Bindings          | The `AI_MODEL`, `AI_GATEWAY_ID`, and `AI_DAILY_LIMIT` variables, the `AI_LIMITER` rate limit, and `workflows` with `BREAKDOWN`, in all three configurations; `"ai": { "binding": "AI" }` exists only in `env.production` |
| Exports           | `TaskBreakdownWorkflow` from `src/server.ts` and `test/worker.ts`                                                                                                                                                        |
| Migration         | Drops the `ai_usage` table                                                                                                                                                                                               |
| Packages          | None                                                                                                                                                                                                                     |

Edit:

- `src/components/board/board-page.tsx`: the "Break down with AI" menu item,
  its status query, polling, and status text. Subtasks already created still
  show.
- `src/db/schema/index.ts`: the `ai-usage` export.
- `src/modules/realtime/rooms.server.ts`, if `realtime` stays:
  `broadcastBoardEvents`, which only the Workflow called.
- `scripts/setup/core.mjs` and its test: the Workflow rename step.
- `src/modules/seo/negotiation.test.ts`: it asserts the Workers AI allowance
  row.
- `vitest.config.ts`: the comment on `remoteBindings: false`, which stays.
- Public copy in `src/modules/seo/homepage.ts` (summary, Worker card, rate
  limit row, Workflows and Workers AI rows, allowance, risk, guardrail) and
  `src/modules/seo/llms.txt`.
- Docs: `README.md`, `AGENTS.md`, `docs/OVERVIEW.md`, `docs/DEVELOPMENT.md`,
  `docs/DEPLOYMENT.md`, `docs/INSTALLING.md`, `docs/FEATURES.md`, and
  [ADR-0013](decisions/0013-workers-ai-model-and-gateway.md), which becomes
  superseded.
- Skills: `add-module` uses `ai` as an example.

Delete by hand: the production Workflow with
`wrangler workflows delete <worker-name>-task-breakdown`, and the AI Gateway if
nothing else uses it; its logs hold task titles and notes. Workers AI and Rate
Limiting create no resources.

`task.parent_id` and the subtask display stay: they are part of the core
tasks table.

## mcp

The remote MCP server at `/mcp`, its OAuth 2.1 authorization through Better
Auth's OAuth provider, the consent page, and the WebMCP browser tools.

| What              | Remove                                                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Folders and files | `src/modules/mcp/`, `src/components/web-mcp.tsx` and its test, `src/routes/oauth/`, `src/db/schema/oauth.ts`, `src/modules/discovery/skills/`, `e2e/web-mcp.spec.ts` |
| Bindings          | None                                                                                                                                                                 |
| Exports           | None. `src/server.ts` loses its `/mcp` dispatch, OAuth discovery handler, and CORS handling                                                                          |
| Migration         | Drops `jwks`, `oauth_access_token`, `oauth_client`, `oauth_client_assertion`, `oauth_client_resource`, `oauth_consent`, `oauth_refresh_token`, and `oauth_resource`  |
| Packages          | `@better-auth/mcp`, `@better-auth/oauth-provider`, and `@modelcontextprotocol/server`, with `pnpm remove`                                                            |

Most of the coupling sits in `auth` and never names `modules/mcp`, so search
for `mcp|oauth|jwks|webmcp|modelContext|consent|server-card|ai-catalog|agent-skills`.

Edit:

- `src/modules/auth/auth.server.ts`: the `jwt()` and `mcp()` plugins and the
  OAuth page settings. The OAuth provider goes with MCP: it protected only
  `/mcp`, and keeping it leaves open client registration with nothing behind
  it.
- `src/modules/auth/client.ts`, `redirects.ts`, `repository.server.ts`, and
  `src/routes/login.tsx`: the OAuth client plugin, the resume-after-sign-in
  step, and the OAuth tables in the adapter schema.
- `src/modules/auth/rate-limit.server.ts` and its test: `/oauth2/register`.
- `src/routes/__root.tsx`: `<WebMcpTools />`.
- `src/modules/tasks/repository.server.ts`: `listTasksForUser`, which only
  MCP used.
- `src/modules/discovery/`: serve only the API catalog, listing
  `/api/health`. The MCP server cards, AI Catalog and ARD, agent skills index,
  task skill, and OAuth metadata describe the removed server, so they go.
- `scripts/smoke.mjs`: the `/mcp` challenge, OAuth metadata, server card, AI
  Catalog, and skills checks; assert the catalog lists only the health
  endpoint.
- `scripts/prepare-e2e-account.mjs`: the WebMCP test account.
- `scripts/setup/core.mjs` and its test: comments and fixtures naming MCP.
- Public copy in `src/modules/seo/homepage.ts` and `src/modules/seo/llms.txt`,
  which should say MCP, WebMCP, and OAuth client access are not offered.
- Docs: `README.md`, `AGENTS.md`, `docs/OVERVIEW.md`, `docs/DEPLOYMENT.md`,
  `docs/DEVELOPMENT.md`, `docs/AGENT_DISCOVERY.md`, `docs/FEATURES.md`, and an
  ADR superseding [ADR-0014](decisions/0014-mcp-oauth-with-better-auth.md) and
  part of [ADR-0015](decisions/0015-worker-served-agent-discovery.md).

Clean up by hand: the DNS-AID record `_mcp._agents.<host>`, and any MCP
connectors people added. There are no Cloudflare resources.

WebMCP needs no OAuth and could become its own module if a fork wants
in-browser tools without `/mcp`.

## Evidence

Each branch was cut from `1e385f6`, pushed, and never merged or deployed.
All four CI jobs passed on each: the three Node verify jobs and the Cloudflare
types and dry run.

| Module     | Branch                      | Commit    | CI run                                                                          |
| ---------- | --------------------------- | --------- | ------------------------------------------------------------------------------- |
| `files`    | `throwaway/remove-files`    | `635b3be` | [36317877078](https://github.com/tanfust/tanbase-core/actions/runs/36317877078) |
| `realtime` | `throwaway/remove-realtime` | `e206b41` | [36318535010](https://github.com/tanfust/tanbase-core/actions/runs/36318535010) |
| `jobs`     | `throwaway/remove-jobs`     | `01877b2` | [36318052946](https://github.com/tanfust/tanbase-core/actions/runs/36318052946) |
| `ai`       | `throwaway/remove-ai`       | `d8507ae` | [36318206655](https://github.com/tanfust/tanbase-core/actions/runs/36318206655) |
| `mcp`      | `throwaway/remove-mcp`      | `e0143c3` | [36318180110](https://github.com/tanfust/tanbase-core/actions/runs/36318180110) |
