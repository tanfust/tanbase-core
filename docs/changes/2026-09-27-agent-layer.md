---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-27
---

# 2026-09-27: Agent layer: module map, rules, and task skills

## Summary

`AGENTS.md` now carries the stack, a module map, the ownership and binding
rules, and the everyday commands. Four project skills in `.claude/skills/`
cover adding a table, adding a module, removing a module, and deploying. A
fresh agent used them to add a CRUD table without help, and the gaps it found
are fixed.

## Motivation

F-020 makes the repository navigable for coding agents, the audience that
chooses a template partly by how well its agents can work in it. The contract
existed, but an agent had to reconstruct where code lives and how a table,
binding, or deploy is done from scattered guides.

## Behavior and configuration changes

- `AGENTS.md` adds Stack, Module map (paths, modules with their bindings, the
  optional modules, and the per-module file convention), Ownership rule,
  Binding rules, Commands, and Skills sections.
- `.claude/skills/add-table`, `add-module`, `remove-module`, and `deploy` are
  runbooks with commands and examples taken from the code. They sit beside the
  symlinked third-party skills, and `AGENTS.md` tells other agents to read
  them as checklists.
- `pnpm db:generate` now also runs Prettier on `drizzle/migrations/meta`, so a
  generated snapshot and journal pass `pnpm verify` without a manual step.
- `src/modules/tasks/functions.server.ts` maps projects and tasks to their
  views field by field. It returned whole rows before, so board responses and
  live-board events carried the owner's `userId` and `reminderSentAt` to the
  owner's browser. No other user ever received them.
- README and the development guide point to the skills.

## Migrations and environment changes

None.

## Validation evidence

Local:

- The acceptance run for the last F-020 criterion: a general-purpose agent
  with no context from the authoring session, in its own git worktree at
  `7843e5f`, was asked to add a user-owned `labels` table with server-side
  CRUD using only the repository's docs. In about nine minutes it added the
  schema, migration `0005`, repository, Zod schemas, view type, server
  functions, query options, and 12 tests covering CRUD, ordering, cross-user
  isolation, and schema limits. Its final `pnpm verify` passed: 22 Worker test
  files with 187 tests, 21 UI, 23 setup, and 6 script tests. The work stayed
  on a local throwaway branch, `worktree-agent-labels` at `cb2da9b`, and was
  not merged.
- It reported five gaps, each fixed here: unformatted `db:generate` output,
  no rule for when a table needs a new module, an undefined `toWidgetView` in
  the example, no guidance for inserting test fixtures without `getDb()`, and
  the cited tasks code returning whole rows to the client. It also noted that
  the example index lacked the ID tiebreaker and that enum values were
  duplicated; the skill now shows the tiebreaker and one source for enum
  values.
- `pnpm db:generate` with no schema changes leaves every existing snapshot
  unchanged.
- `pnpm verify` steps without `.dev.vars`: 175 Worker, 21 UI, 23 setup, and 6
  script tests passed, with format, lint, docs, schema, types, boundaries, and
  build.
- `pnpm test:e2e` with the system Chrome: 3 passed, including board CRUD,
  realtime create and move between two pages, attachments, and settings, so
  the field-by-field views still carry everything the board reads.
- `pnpm cf:dry-run:production` — passed.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result       |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------------ |
| Local      | Working tree based on `307cb23` | `http://localhost:3110`    | 2026-09-27 | Passed       |
| Production | —                               | `https://core.tanbase.dev` | —          | Not deployed |

## Rollback notes

Revert the change. The view mapping is internal to the tasks module; the
client never read the fields it drops.

## Remaining work

F-021 performs each module removal once and records the exact steps, which
the `remove-module` skill then follows.
