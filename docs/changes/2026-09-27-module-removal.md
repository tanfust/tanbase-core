---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-27
---

# 2026-09-27: Module removal, proven for every optional module

## Summary

Each optional module (`files`, `realtime`, `jobs`, `ai`, and `mcp`) was
removed once from `main` on a throwaway branch, and CI passed on every branch.
The exact lists are in a new [module removal guide](../MODULE_REMOVAL.md),
summarized per module in the README. The `remove-module` skill now follows
that guide and covers what the trials found it missed.

## Motivation

F-021 is on the launch path. Forks keep what they need and delete the rest,
so the claim that modules are deletable has to be demonstrated, not stated.
The `remove-module` skill from F-020 was written before any removal had run.

## Behavior and configuration changes

- New `docs/MODULE_REMOVAL.md`: before-you-start rules, one section per
  module, and an evidence table. Each section covers the folders, bindings in
  every configuration, exports, migrations, packages, edits elsewhere, and
  cloud resources to delete by hand.
- `README.md` gains "Removing a module", listing folders, bindings, exports,
  and migrations per module. `docs/README.md` and `AGENTS.md` link the guide.
- The `remove-module` skill is rewritten from the trials. It adds:
  - searching the module's imports for dead helpers, and MCP's own
    vocabulary
  - `wrangler.e2e.jsonc`, `e2e/`, `scripts/seed.sql`, `scripts/setup.mjs`,
    `scripts/prepare-e2e-account.mjs`, tests that assert public copy,
    `docs/FEATURES.md`, `docs/STATUS.md`, ADRs, and the skills that cite the
    module
  - regenerating the route tree
  - `"triggers": { "crons": [] }` in production
  - dropping columns from core tables
  - the two-deploy order for drop migrations
  - packages
  - behavior a module supplied without being called
  - the browser journeys
- The `add-module` skill declares bindings in `wrangler.e2e.jsonc` when the
  browser tests need them, places connection origins in `src/server.ts`'s
  `connectSources`, and asks for a removal section for each new optional
  module.

## Migrations and environment changes

None on `main`. The removal branches generated migrations that were never
merged.

## Validation evidence

Local and CI, one branch per module. Each was cut from `1e385f6`, was never
merged or deployed, and passed all four CI jobs on its first push. Every
branch also passed `pnpm verify` and `pnpm cf:dry-run:production` locally,
and the browser journeys with the system Chrome.

| Module     | Commit    | CI run                                                                          | Local Worker tests |
| ---------- | --------- | ------------------------------------------------------------------------------- | ------------------ |
| `files`    | `635b3be` | [36317877078](https://github.com/tanfust/tanbase-core/actions/runs/36317877078) | 165                |
| `realtime` | `e206b41` | [36318535010](https://github.com/tanfust/tanbase-core/actions/runs/36318535010) | 166                |
| `jobs`     | `01877b2` | [36318052946](https://github.com/tanfust/tanbase-core/actions/runs/36318052946) | 167                |
| `ai`       | `d8507ae` | [36318206655](https://github.com/tanfust/tanbase-core/actions/runs/36318206655) | 153                |
| `mcp`      | `e0143c3` | [36318180110](https://github.com/tanfust/tanbase-core/actions/runs/36318180110) | 149                |

What the trials found beyond the original skill:

- A drop migration shipped with the code removal runs before the new code, so
  the old Worker briefly fails on the missing table or column.
- A deployed cron survives a missing `triggers` key.
- `wrangler.e2e.jsonc` and the browser journeys are invisible to CI.
- Removing `realtime` silently stopped WebMCP writes from reaching the board.
  The trial added a refetch, so the guide lists that edit.
- MCP's coupling lives in `auth` under OAuth names, and it takes the OAuth
  provider and most discovery documents with it.

This pull request changes only documentation and skills; `pnpm docs:check`
and the format check pass.

## Deployment state

| Target     | Commit | URL                        | Date | Result                    |
| ---------- | ------ | -------------------------- | ---- | ------------------------- |
| Local      | —      | —                          | —    | Five removal trials above |
| Production | —      | `https://core.tanbase.dev` | —    | Docs only; not needed     |

## Rollback notes

Revert the change. Production code is untouched.

## Remaining work

F-023 adds the Deploy to Cloudflare button and the fresh-account install test.
