---
name: remove-module
description: Remove an optional TanBase Core module (files, realtime, jobs, ai, or mcp) with its bindings, Worker exports, routes, UI, tables, installer steps, and docs, leaving CI green. Use when a fork does not need a feature, such as "remove attachments", "drop the live board", "delete the AI breakdown", or "I don't need MCP".
---

# Remove an optional module

`files`, `realtime`, `jobs`, `ai`, and `mcp` are designed to be removable.
`auth`, `tasks`, `email`, `seo`, and `discovery` are the core; do not remove
them with this skill.

Work on a branch. Removal deletes code and, once deployed, can delete
production data, so confirm with the person before any step that destroys
data.

## 1. Find every reference

```sh
git grep -n "modules/<name>"
git grep -n "<BINDING>"          # for example FILES, BOARD, EMAIL_QUEUE, BREAKDOWN, AI
```

Check each of these places:

| Place                                                                | What to look for                                                                                                                         |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/<name>/`                                                | The module itself                                                                                                                        |
| `src/server.ts`                                                      | Class exports, `fetch` dispatch, `scheduled` and `queue` handlers                                                                        |
| `test/worker.ts`                                                     | Class exports and handlers for the test pool                                                                                             |
| `wrangler.jsonc`                                                     | The binding, and `migrations`, `triggers`, or `queues`, in the base config and in `env.production`                                       |
| `src/routes/`, `src/components/`                                     | Routes, API routes, and UI that call the module                                                                                          |
| Other modules                                                        | Calls into it, such as `tasks` publishing board events or deleting files                                                                 |
| `src/lib/health.ts`, `src/routes/api/health.ts`, `scripts/smoke.mjs` | Its health check and the smoke assertion for it                                                                                          |
| `src/db/schema/`, `drizzle/`                                         | Tables only this module uses                                                                                                             |
| `scripts/setup/`                                                     | Installer steps that provision its resources                                                                                             |
| `src/platform/security-headers.ts`                                   | CSP origins it added                                                                                                                     |
| Docs                                                                 | `AGENTS.md` module map, `docs/OVERVIEW.md` primitive map, `docs/DEPLOYMENT.md`, `docs/DEVELOPMENT.md`, `docs/INSTALLING.md`, `README.md` |
| Public copy                                                          | The primitive map in `src/modules/seo/homepage.ts`, `src/modules/seo/llms.txt`, and discovery documents                                  |

## 2. Remove the code

Delete the module folder, then fix every caller the typecheck reports. When a
core module calls the removed one, delete the call, not the core behavior.
For example, deleting a task must still work without attachments.

## 3. Remove the binding

Remove the binding from the base config and from `env.production` in
`wrangler.jsonc`, then:

```sh
pnpm cf:typegen
```

Primitive-specific steps:

- **Durable Object:** remove the class from `src/server.ts` and
  `test/worker.ts`, then append a migration with a new tag that deletes it, in
  the base config and in `env.production`:

  ```jsonc
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["BoardRoom"] },
    { "tag": "v2", "deleted_classes": ["BoardRoom"] },
  ],
  ```

  Deploying it permanently deletes every object of the class and its storage.
  A fork that has never deployed can delete the `v1` entry instead.

- **Workflow:** remove the class exports and the `workflows` entry. The
  production Workflow stays in the account until the operator deletes it.
- **Queue and cron:** remove the producer, consumer, and `triggers`, and the
  `queue` or `scheduled` handler when nothing else uses it. The queues stay in
  the account until the operator deletes them.
- **R2:** remove the bucket binding. The bucket and its objects stay until the
  operator empties and deletes them.
- **Workers AI:** remove the `ai` binding and the `AI_*` variables.

Tell the person which cloud resources remain, so they can delete them on
purpose.

## 4. Remove its tables

Delete the module's schema files and their exports from
`src/db/schema/index.ts`, then generate a migration that drops them:

```sh
pnpm db:generate
pnpm db:check
```

Never delete or edit merged migration files. The drop migration deletes
production data when it deploys, so confirm first, and copy anything worth
keeping.

## 5. Remove installer steps and health checks

- Remove its steps from `scripts/setup/` and their tests, then run
  `pnpm test:setup`.
- Remove its health check and update the `checks` object in
  `scripts/smoke.mjs`.

## 6. Update docs and public copy

Remove the module from every doc and public surface in the table in step 1.
Nothing may claim a capability the deployment no longer has. Add a change
record.

## 7. Verify

```sh
pnpm verify
pnpm cf:dry-run:production
pnpm dev
```

Sign in locally and use the board, so a removed module's leftovers fail now
rather than in production. Then follow the `deploy` skill.

F-021 performs each removal once and records the exact file lists; follow
those notes when they exist.
