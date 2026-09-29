---
status: active
audience: users, contributors, agents
last_verified: 2026-09-27
---

# Removing optional modules

`files`, `realtime`, `jobs`, `ai`, `mcp`, `og`, and `blog` are optional. The
first five removals were each performed once, from `main` at `1e385f6`, on a
throwaway branch whose CI passed. `og` and `blog` came later and were removed
in local worktrees; see [Evidence](#evidence). The
[`remove-module` skill](../.claude/skills/remove-module/SKILL.md) follows
these lists. The [README](../README.md#removing-a-module) summarizes them.

## Before you start

- **Deploy the removal in two steps if the fork is already in production.**
  Workers Builds applies D1 migrations before it deploys the new code, so for
  a few seconds the old Worker runs against the new schema. Ship the code
  removal first. Ship the migration that drops the module's tables or
  columns in a later deploy. A Worker rollback after the drop needs a
  migration that recreates what it dropped.
- **Edit every Wrangler section:** the top level, which the Deploy to
  Cloudflare button deploys, `env.local` for local development,
  `env.production`, and `wrangler.e2e.jsonc` for the browser tests. These
  trials ran before the top level became a generic production configuration
  ([ADR-0017](decisions/0017-wrangler-configuration-layout.md)), so where a
  section below says "the base configuration", edit both the top level and
  `env.local`. CI does not run the browser tests, so a stale e2e configuration
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
| Bindings          | `r2_buckets` with `FILES` in `env.local`, `env.production`, and `wrangler.e2e.jsonc`; the top level has none since ADR-0021                               |
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
- `scripts/deploy-resources.mjs` and its tests: `prepareFiles`,
  `filesBucketName`, `withFilesBinding`, `bucketStatus`, and the attachments
  messages; `scripts/deploy.mjs`: the R2 step and the `Attachments:` line.
- `src/modules/files/storage.server.test.ts` goes with the folder; the
  generated `src/worker-configuration.d.ts` drops `FILES` after
  `pnpm cf:typegen`.
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
  `src/modules/discovery/skills/tasks/SKILL.md`.
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

| What              | Remove                                                                                                                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Folders and files | `src/modules/jobs/`                                                                                                                                                                                                                     |
| Bindings          | `queues` (producer, consumer, dead-letter queue) in `env.local` and `wrangler.e2e.jsonc`, and `triggers` in each. In `env.production`, remove `queues` and set `"triggers": { "crons": [] }`; the top level has no queue since ADR-0022 |
| Exports           | The `scheduled` and `queue` handlers in `src/server.ts`, and the `queue` handler in `test/worker.ts`                                                                                                                                    |
| Migration         | Drops the `task_due_reminder_idx` index and the `task.reminder_sent_at` column                                                                                                                                                          |
| Packages          | None                                                                                                                                                                                                                                    |

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
- `scripts/deploy-resources.mjs` and its tests: `emailQueueName` and
  `withEmailQueue`; `scripts/deploy.mjs`: the queue step and the
  `Reminders:` line.
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

| What              | Remove                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Folders and files | `src/modules/ai/`, `src/db/schema/ai-usage.ts`                                                                                                                                                                                             |
| Bindings          | The `AI_MODEL`, `AI_GATEWAY_ID`, and `AI_DAILY_LIMIT` variables, the `AI_LIMITER` rate limit, and `workflows` with `BREAKDOWN`, in all three configurations; `"ai": { "binding": "AI" }` exists only in the top level and `env.production` |
| Exports           | `TaskBreakdownWorkflow` from `src/server.ts` and `test/worker.ts`                                                                                                                                                                          |
| Migration         | Drops the `ai_usage` table                                                                                                                                                                                                                 |
| Packages          | None                                                                                                                                                                                                                                       |

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

## og

Link preview images: the fixed cards, the Takumi renderer, and the
`OgImage` entrypoint that Workers Caching keeps
([ADR-0018](decisions/0018-preview-images-on-the-worker.md)).

| What              | Remove                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Folders and files | `src/modules/og/`                                                                                                                        |
| Bindings          | None. The `exports` block with `OgImage`, which turns on Workers Caching, goes from all three configurations and `wrangler.e2e.jsonc`    |
| Exports           | `OgImage` from `src/server.ts` and `test/worker.ts`. `src/server.ts` also loses its `/og/` dispatch and the `ctx` it passed to `route()` |
| Migration         | None                                                                                                                                     |
| Packages          | `@takumi-rs/wasm`, with `pnpm remove`                                                                                                    |

Edit:

- `src/modules/seo/head.ts` and its test: the `image` option, its type
  import, and the `og:image` and `summary_large_image` tags. Every page keeps
  a text-only `summary` card.
- `src/routes/index.tsx`: `image: ogImage("home")`.
- `scripts/smoke.mjs`: the `og:image`, `twitter:card`, and `/og/home.png`
  checks.
- Public copy in `src/modules/seo/homepage.ts`: the link preview images row.
- `blog`, if it stays: `postImage()` in `src/modules/blog/contracts.ts` and
  the `image` options in `src/modules/blog/pages.server.ts`. The og module's
  `postCards()` fallback goes with it.
- Docs: `README.md`, `AGENTS.md`, `docs/OVERVIEW.md`, `docs/DEVELOPMENT.md`,
  `docs/AGENT_DISCOVERY.md`, `docs/FEATURES.md`, and an ADR superseding
  [ADR-0018](decisions/0018-preview-images-on-the-worker.md).

There are no Cloudflare resources to delete. Cached images expire with the
next deploy, because the Worker version is part of the cache key. Sites that
already fetched a preview keep their own copy.

## blog

The public blog: posts from `content/blog`, their pages, head tags, RSS feed,
sitemap entries, and preview cards
([ADR-0019](decisions/0019-blog-from-repository-markdown.md)).

| What              | Remove                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Folders and files | `content/blog/`, `src/modules/blog/`, `src/routes/blog.tsx`, `src/routes/blog/`, `e2e/blog.spec.ts` |
| Bindings          | None                                                                                                |
| Exports           | None                                                                                                |
| Migration         | None                                                                                                |
| Packages          | `@tanstack/markdown`, with `pnpm remove`                                                            |

Edit:

- `src/modules/og/content.server.ts`: the `postCards()` import and fallback in
  `ogCardForPath()`, the `blog` card, and the comment about posts.
  `src/modules/og/cards.ts`: the `blog` card and the comment about post cards.
  Skip both if `og` is already gone.
- `src/routes/sitemap[.]xml.ts`: the `blogUrls()` import and entries; the
  comment on `publicUrls()` in `src/modules/seo/discovery.ts`.
- Public copy: the Blog footer link in `src/modules/seo/homepage.ts`, and the
  blog sentence, Blog link, and sitemap line in `src/modules/seo/llms.txt`.
- `src/styles.css`: the `.blog-prose` block.
- `vite.config.ts`: the `@tanstack/markdown` entries in `routeDependencies`.
- `.github/workflows/ci.yml`: the `perf:bundle --path /blog` step.
- `scripts/smoke.mjs`: the blog block, and the sitemap check back to the
  homepage alone. The smoke checks came after the removal trial below.
- `src/routeTree.gen.ts`: regenerate it with `pnpm build`.
- Docs: `README.md`, `AGENTS.md` (stack, module map, optional list, foundation
  paragraph), `docs/OVERVIEW.md`, `docs/DEVELOPMENT.md`,
  `docs/PERFORMANCE.md`, `docs/AGENT_DISCOVERY.md`, `docs/FEATURES.md`, and an
  ADR superseding
  [ADR-0019](decisions/0019-blog-from-repository-markdown.md).

The `article` option of `seo()` in `src/modules/seo/head.ts` can stay; it is
generic. There are no Cloudflare resources to delete. Search engines drop the
posts' URLs once they return 404.

## Evidence

Each branch was cut from `1e385f6`, pushed, and never merged or deployed.
All four CI jobs passed on each: the three Node verify jobs and the Cloudflare
types and dry run. The branches were deleted on 2026-09-27; the CI runs stay
linked below.

| Module     | Branch                      | Commit    | CI run                                                                          |
| ---------- | --------------------------- | --------- | ------------------------------------------------------------------------------- |
| `files`    | `throwaway/remove-files`    | `635b3be` | [36317877078](https://github.com/tanfust/tanbase-core/actions/runs/36317877078) |
| `realtime` | `throwaway/remove-realtime` | `e206b41` | [36318535010](https://github.com/tanfust/tanbase-core/actions/runs/36318535010) |
| `jobs`     | `throwaway/remove-jobs`     | `01877b2` | [36318052946](https://github.com/tanfust/tanbase-core/actions/runs/36318052946) |
| `ai`       | `throwaway/remove-ai`       | `d8507ae` | [36318206655](https://github.com/tanfust/tanbase-core/actions/runs/36318206655) |
| `mcp`      | `throwaway/remove-mcp`      | `e0143c3` | [36318180110](https://github.com/tanfust/tanbase-core/actions/runs/36318180110) |

`og` was removed from `0d47e61`, the F-017 commit, in a local worktree on
`throwaway/remove-og`, which was never pushed. The code came back to `main`'s
except for one stale comment. `pnpm verify` without `.dev.vars` passed with
182 Worker tests. `pnpm cf:dry-run:production` and `pnpm cf:dry-run:default`
passed, and the upload shrank to 5.8 MiB. `pnpm test:e2e` passed 3 tests.

`blog` was removed from `18cb00a`, the F-031 commit, in a local worktree on
`throwaway/remove-blog`, which was never pushed: 27 files changed, 1,245 lines
removed. `pnpm verify` without `.dev.vars` passed with 214 Worker tests and 36
UI tests. `pnpm test:e2e` passed its 4 remaining tests, and
`pnpm cf:dry-run:production` passed with a 10,407 KiB upload, 3,157 KiB
gzipped.
