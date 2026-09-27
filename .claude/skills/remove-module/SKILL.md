---
name: remove-module
description: Remove an optional TanBase Core module (files, realtime, jobs, ai, or mcp) with its bindings, Worker exports, routes, UI, tables, installer steps, and docs, leaving CI green. Use when a fork does not need a feature, such as "remove attachments", "drop the live board", "delete the AI breakdown", or "I don't need MCP".
---

# Remove an optional module

`files`, `realtime`, `jobs`, `ai`, and `mcp` are designed to be removable.
`auth`, `tasks`, `email`, `seo`, and `discovery` are the core; do not remove
them with this skill.

`docs/MODULE_REMOVAL.md` lists, for each module, every file a real removal
changed, what it dropped, and the cloud resources left behind. Each list was
proven once on a branch with CI green. Open the module's section now and
work through it alongside the steps below.

Work on a branch. Removal deletes code and, once deployed, can delete
production data, so confirm with the person before any step that destroys
data.

## 1. Find every reference

Before deleting anything, list what the module imports from other modules.
Each of those symbols may become dead code:

```sh
git grep -h "from \"@/modules" src/modules/<name>
```

Then search for the module, its bindings, and its vocabulary:

```sh
git grep -n "modules/<name>"
git grep -n "<BINDING>"          # for example FILES, BOARD, EMAIL_QUEUE, BREAKDOWN, AI
```

For `mcp`, most coupling sits in `auth` and never names the module, so also
search for `mcp|oauth|jwks|webmcp|modelContext|consent|server-card|ai-catalog|agent-skills`.

Check every place below. The guide says which ones each module touches.

| Place                                                        | What to look for                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/<name>/`                                        | The module itself                                                                                                                                                                                                                                                                       |
| `src/server.ts`                                              | Class exports, `fetch` dispatch, `scheduled` and `queue` handlers, CSP `connectSources`                                                                                                                                                                                                 |
| `test/worker.ts`                                             | Class exports and handlers for the test pool                                                                                                                                                                                                                                            |
| `wrangler.jsonc`, `wrangler.e2e.jsonc`                       | Bindings, variables, `ratelimits`, `migrations`, `triggers`, `queues`, `workflows`: base, `env.production`, and e2e                                                                                                                                                                     |
| `src/routes/`, `src/components/`                             | Routes, API routes, UI, and component tests that use it                                                                                                                                                                                                                                 |
| Other modules                                                | Calls into it, and helpers that only it called                                                                                                                                                                                                                                          |
| `src/db/schema/`, `drizzle/`, `scripts/seed.sql`             | Tables and columns only this module uses                                                                                                                                                                                                                                                |
| `src/lib/health.ts` and its test, `src/routes/api/health.ts` | Its health check                                                                                                                                                                                                                                                                        |
| `scripts/smoke.mjs`, `scripts/prepare-e2e-account.mjs`       | Its smoke assertions and test accounts                                                                                                                                                                                                                                                  |
| `scripts/setup.mjs`, `scripts/setup/`                        | Installer steps, state keys, and their tests                                                                                                                                                                                                                                            |
| `e2e/`                                                       | Browser journeys. CI does not run them, so CI stays green when they break                                                                                                                                                                                                               |
| `vitest.config.ts`, `package.json`                           | Comments and packages only this module used                                                                                                                                                                                                                                             |
| Public copy                                                  | `src/modules/seo/homepage.ts` (summary, Worker card, primitive map, allowances, risks, guardrails, installer line), `llms.txt`, discovery documents, MCP tool descriptions                                                                                                              |
| Tests that assert public copy                                | For example `src/modules/seo/negotiation.test.ts`                                                                                                                                                                                                                                       |
| Docs                                                         | `README.md`, `AGENTS.md` (module map, optional list, foundation paragraph), `docs/OVERVIEW.md` (primitive map, entities, budgets, cost model), `docs/DEVELOPMENT.md`, `docs/DEPLOYMENT.md`, `docs/INSTALLING.md`, `docs/FEATURES.md`, `docs/STATUS.md`, ADRs, `docs/AGENT_DISCOVERY.md` |
| Skills                                                       | `add-module` and `add-table` examples that cite the module, and this skill's module list                                                                                                                                                                                                |

## 2. Remove the code

Delete the module folder, then fix every caller the typecheck reports. When a
core module calls the removed one, delete the call, not the core behavior.
For example, deleting a task must still work without attachments.

Typecheck misses three things; look for them:

- Helpers elsewhere that only the removed module used, found from the import
  list in step 1.
- Behavior the module supplied without being called. Removing `realtime`, for
  example, stopped WebMCP writes from reaching the board, so the board had to
  refetch after them.
- Comments and copy that describe the removed behavior.

After deleting a route, run `pnpm build` or `pnpm dev` to regenerate
`src/routeTree.gen.ts`, or `pnpm typecheck` fails.

## 3. Remove the bindings

Remove the binding from the top level, `env.local`, `env.production`, and
`wrangler.e2e.jsonc`, then:

```sh
pnpm cf:typegen
```

Primitive-specific steps:

- **Durable Object:** remove the class from `src/server.ts` and
  `test/worker.ts`, then append a migration with a new tag that deletes it, in
  the top level, `env.local`, and `env.production`:

  ```jsonc
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["BoardRoom"] },
    { "tag": "v2", "deleted_classes": ["BoardRoom"] },
  ],
  ```

  Deploying it permanently deletes every object of the class, and Cloudflare
  refuses a rollback across it. Keep deployed entries: migrations are a
  history. `wrangler.e2e.jsonc` and a fork that never deployed can drop the
  binding and `v1` entry outright.

- **Cron:** in `env.production`, set `"triggers": { "crons": [] }`. A deployed
  cron stays when the key is simply missing. Remove the `scheduled` handler.
- **Queue:** remove the producer, consumer, and the `queue` handler when
  nothing else uses it. The queues stay in the account until the operator
  deletes them with `wrangler queues delete`.
- **Workflow:** remove the class exports and the `workflows` entry. The
  operator deletes the production Workflow with `wrangler workflows delete`.
- **R2:** remove the bucket binding. The bucket and its objects stay until the
  operator empties and deletes them.
- **Workers AI:** remove `ai` from `env.production`, where alone it exists, the
  `AI_*` variables, and the `AI_LIMITER` entry in `ratelimits`. AI Gateway
  stays, with logs of every prompt, until the operator deletes it.
- **CSP:** remove any origin the module added, in
  `src/platform/security-headers.ts` or as a `connectSources` entry in
  `src/server.ts`.
- **Packages:** remove packages only the module used with `pnpm remove`, so
  `pnpm install --frozen-lockfile` still passes.

Tell the person which cloud resources remain, so they can delete them on
purpose.

## 4. Remove its data

Delete the module's schema files and their exports from
`src/db/schema/index.ts`. For a column on a core table, remove it from the
schema and from every writer, including other modules and `scripts/seed.sql`.
Then:

```sh
pnpm db:generate
pnpm db:check
pnpm db:migrate:local
```

Read the SQL. A column drop must be an `ALTER TABLE ... DROP COLUMN`, not a
table rebuild, which could cascade into child rows. Never delete or edit
merged migration files.

If the fork is already in production, deploy in two steps. Workers Builds
applies migrations before it deploys the code, so shipping the drop with the
removal leaves the old Worker running against the new schema for a few
seconds. Merge the code removal first, and the drop migration in a later pull
request. A rollback after the drop needs a migration that recreates what it
dropped. The drop deletes production data: confirm first, and copy anything
worth keeping.

## 5. Remove installer steps, health checks, and smoke

- Remove its steps from `scripts/setup.mjs` and `scripts/setup/`, their state
  keys, and their tests, then run `pnpm test:setup`.
- If it has a health check, remove it from `src/lib/health.ts`, its test, and
  the `checks` object that `scripts/smoke.mjs` asserts. The new smoke then
  fails against the old version, so judge it only after the new version is
  live, as the post-deploy smoke does.
- Remove its other smoke blocks and e2e journeys.

## 6. Update docs and public copy

Remove the module from every doc and public surface in step 1. Nothing may
claim a capability the deployment no longer has.

- Mark its features `⛔ Dropped` in `docs/FEATURES.md`, and its ADRs
  `superseded`, with a link to the change record or a new ADR.
- Add a line to `docs/STATUS.md` saying the removal is not deployed yet.
- Add a change record and list it in `docs/changes/README.md`.

## 7. Verify

```sh
pnpm verify
pnpm cf:dry-run:production
pnpm test:e2e
```

`pnpm test:e2e` covers sign-up, the board, and settings in a browser, which
CI does not. It and `pnpm dev` need the local secrets in `.dev.vars`, which
`pnpm run setup --local-only` creates; alternatively, pass them as
environment variables with `CLOUDFLARE_INCLUDE_PROCESS_ENV=true`. If the auth
secret changed, delete `.wrangler/e2e-state` first. Then follow the `deploy`
skill.
