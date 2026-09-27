---
name: add-module
description: Add a feature module to TanBase Core under src/modules/<name>, with or without a new Cloudflare binding (KV, R2, D1, Queues, Durable Objects, Workflows, Workers AI, Rate Limiting, Email, secrets). Use when adding a product feature, integrating a new Cloudflare primitive, or wiring a new binding into wrangler.jsonc.
---

# Add a feature module

Read `AGENTS.md` first: the module map, binding rules, and definition of done.
A primitive enters the repository only with a feature that uses it. If
nothing in the product exercises the binding yet, do not add it.

Good examples to copy:

| Need                     | Module to read                                         |
| ------------------------ | ------------------------------------------------------ |
| D1 data only             | `src/modules/tasks/`                                   |
| R2 bucket                | `src/modules/files/`                                   |
| Durable Object           | `src/modules/realtime/`                                |
| Cron and Queues          | `src/modules/jobs/`                                    |
| Workflow and Workers AI  | `src/modules/ai/`                                      |
| A route outside TanStack | `src/modules/mcp/` and its dispatch in `src/server.ts` |

## 1. Layout

Create `src/modules/<name>/` with only the files the feature needs:

- `schemas.ts`, `contracts.ts`, `functions.ts`, `functions.server.ts`,
  `repository.server.ts`, and `queries.ts`, as `AGENTS.md` describes.
- Binding and platform code in `*.server.ts` files. TanStack import
  protection fails the build if a route or component imports one.
- Tests beside the code: `*.test.ts` in the Workers runtime and
  `*.ui.test.tsx` for components.

New tables follow the `add-table` skill.

## 2. A new binding

Declare it twice in `wrangler.jsonc`: in the base configuration for local
development and again under `env.production`. Environments inherit nothing.
Name local resources with a `-local` suffix, as `tanbase-core-files-local`
is. For example, an R2 bucket:

```jsonc
// base
"r2_buckets": [{ "binding": "FILES", "bucket_name": "tanbase-core-files-local" }],
"env": {
  "production": {
    "r2_buckets": [{ "binding": "FILES", "bucket_name": "tanbase-core-files" }],
  },
},
```

Then:

```sh
pnpm cf:typegen
```

Commit the regenerated `src/worker-configuration.d.ts`; CI fails when it
drifts. Never hand-edit it.

Read the binding through a getter in a `.server.ts` file that returns `null`
when it is missing, so an installation without the resource degrades instead
of crashing:

```ts
import { env } from "cloudflare:workers"

export function getFilesBucket(): R2Bucket | null {
  return (env as { FILES?: R2Bucket }).FILES ?? null
}
```

Per primitive:

- **Durable Object:** export the class from `src/server.ts` and from
  `test/worker.ts`, and add a `migrations` entry with a new tag for the class,
  as `v1` does for `BoardRoom`. Durable Objects coordinate; D1 stays the source
  of truth.
- **Workflow:** export the class from both files as well. Workflow names are
  unique per account, so the installer renames production workflows per fork.
- **Queue or cron:** handle them in the `queue` and `scheduled` handlers of
  `src/server.ts`; keep the logic in the module. Declare the consumer and
  dead-letter queue in both environments.
- **Secret:** production values go through `wrangler secret put <NAME> --env
production`, run by the operator. Local values go in ignored `.dev.vars`,
  with a safe placeholder documented. Never commit a value.
- **Workers AI:** the `AI` binding exists only in production. Pass the `Ai`
  binding into the code that calls it, as `generateSubtasks()` in
  `src/modules/ai/model.server.ts` takes it, so tests supply a fake and never
  reach Cloudflare.
- **External origin:** add any new script, frame, or connection origin to the
  CSP in `src/platform/security-headers.ts`, then check it with `pnpm build`
  and `pnpm preview`.

## 3. Health and diagnostics

When the feature cannot work without the binding, add a cached check to
`src/lib/health.ts` and pass the binding from `src/routes/api/health.ts`. The
check reports `ok`, `error`, or `disabled` when the binding is absent. Update
the `checks` object that `scripts/smoke.mjs` asserts with `deepEqual`, or
smoke fails in every environment.

## 4. Installer

If production needs a resource created, teach `scripts/setup/` to create or
reuse it, and to remove the production binding when the account cannot
provide it, as the `FILES`, queue, and `EMAIL` steps do. Keep optional
services out of the default path. Update `docs/INSTALLING.md`. Run
`pnpm test:setup`.

## 5. Tests

- Test the module's logic in the Workers runtime. Miniflare simulates D1, R2,
  KV, Queues, Durable Objects, and Workflows from the base configuration.
- Test ownership: another user must not reach this module's data.
- Tests must pass without `.dev.vars`; CI has no secrets.

## 6. Documentation

Update everything that describes the product:

- `AGENTS.md`: the module map, and the optional-module list if forks may
  remove it.
- `docs/OVERVIEW.md`: the feature-to-primitive map.
- `docs/DEVELOPMENT.md`: a local workflow section when it needs setup.
- `docs/DEPLOYMENT.md`: a section for the production resource and its
  verification.
- `src/modules/seo/homepage.ts`: the landing page's primitive map, and
  `src/modules/seo/llms.txt` when it changes what the site offers. Every
  claim must be true of production.
- `docs/decisions/`: an ADR when the module makes a choice worth recording.
- `docs/FEATURES.md` and a change record.

## 7. Verify

```sh
pnpm verify
pnpm cf:dry-run:production
```

A dry run proves packaging only. The feature is done when production passes
smoke with the evidence recorded; follow the `deploy` skill.
