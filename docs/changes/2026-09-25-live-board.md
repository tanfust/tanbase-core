---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-25
---

# 2026-09-25: Live board on Durable Objects

## Summary

Added F-011. One hibernating `BoardRoom` Durable Object per owner and project
relays task and project changes over WebSockets, so every open device updates
without a refresh. D1 stays the only source of truth.

## Motivation

The live board is the next Cloudflare primitive on the launch path and makes
the task board collaborative across a user's devices.

## Behavior and configuration changes

- `BoardRoom` accepts sockets with the Hibernation API, answers `ping` with
  `pong` through `setWebSocketAutoResponse`, ignores other client messages,
  sets no timers or alarms, and exposes `broadcast()` and `connections()` over
  RPC. It stores nothing.
- `src/server.ts` exports the class and handles `/api/realtime/:projectId`
  before TanStack Start. It requires `GET` with `Upgrade: websocket` (`426`),
  a same-origin `Origin` (`403`), a session (`401`), and an owned project
  (`404`), then forwards to the room named `{userId}:{projectId}`. Upgrade
  responses skip header processing.
- Task create, update, and delete, and project rename and delete, publish
  `task.upserted`, `task.deleted`, `project.renamed`, and `project.deleted`
  after their D1 writes, delivered with `waitUntil` so a failed broadcast only
  logs `realtime.broadcast_failed`.
- `useBoardRealtime` connects to the active project's room, applies events to
  the board's Query cache (never replacing a newer task, removing deleted
  subtasks), sends a heartbeat every 30 seconds, reconnects with jittered
  exponential backoff up to 30 seconds, and refetches the board after every
  reconnect. The board header shows Connecting, Live, or Reconnecting.
  Renames refresh the navigation; a deletion from another device moves this
  one to another project.
- The CSP adds the page's own `wss:` origin to `connect-src`.
- `GET /api/health` adds `checks.realtime` through RPC to a `health` room,
  cached like the other checks, and smoke expects `ok` wherever `BOARD` is
  bound.

## Migrations and environment changes

No database migration. Added the `BOARD` Durable Object binding and the `v1`
migration (`new_sqlite_classes: ["BoardRoom"]`) to the local, production, and
browser-test configurations, and regenerated Worker types. Deployment creates
the class; no resource or secret is needed. `test/worker.ts` exports the class
for the Workers-runtime tests.

## Validation evidence

Local:

- `pnpm verify` — passed: formatting, lint, 44 maintained documents, Drizzle
  history, types, 74 Workers-runtime tests, one component test, 21 installer
  tests, import/database boundaries, and the production build.
- New runtime tests open real sockets through `BOARD` and cover broadcast to
  every socket in a room and none outside it, the heartbeat auto-response,
  `426` without an upgrade, every upgrade guard status, joining the owner's
  room, owner-scoped room names, event parsing, newer-copy protection,
  subtask removal, other-project isolation, and project renames. Health tests
  cover the realtime check and its disabled and error states.
- `pnpm test:e2e` — passed. A second page on the same board, with both showing
  Live, saw a new task 4 ms and a status move 10 ms after the first page
  showed them, within the 1,000 ms limit the test enforces.
- `pnpm test:dev-client` — 74 client modules loaded.
- `pnpm cf:dry-run:production` — passed; 88 Worker modules with
  `env.BOARD (BoardRoom)` and `env.FILES (tanbase-core-files)`.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result                                    |
| ---------- | ------------------------------- | -------------------------- | ---------- | ----------------------------------------- |
| Local      | Working tree based on `fbaf405` | `http://localhost:3110`    | 2026-09-25 | Verify, browser suite, and dry run passed |
| Production | `9712b8e` / version `d97edb50`  | `https://core.tanbase.dev` | 2026-09-25 | Two devices synced; room hibernated       |

Production:

- Workers Build `4bbe27e4` deployed merge `eb0e127` as Worker version
  `d7d9401f` at 22:06 UTC, creating the `BoardRoom` class. Its post-deploy
  smoke failed all three attempts because the Singapore location that
  answered it still served versions `27b14b56` and `3240ddca`, whose health
  response has no `realtime` check. Worker logs confirm the versions; see
  [the deploy smoke change](2026-09-25-deploy-smoke-version.md).
- An independent `pnpm smoke -- --environment production` passed against
  `d7d9401f` at 22:10 UTC with `realtime: ok`. The live CSP `connect-src` is
  `'self' wss://core.tanbase.dev https://*.posthog.com`.
- Workers Build `adb4430f` redeployed the board unchanged in version
  `d97edb50` at 22:22 UTC. At 22:23 UTC the operator signed in on two
  devices, served from the `GIG` and `BCN` locations, and confirmed that a
  change on one appeared on the other without a refresh. Durable Object
  analytics for that minute show one board room with two concurrent sockets
  and two outbound messages, and the Worker logs show the broadcast RPC
  succeeding.
- Hibernation: the room's sockets were open from about 22:23:16 until at least
  the 22:23:57 broadcast, roughly 42 seconds, but the room accrued only
  402 ms of `activeTime` (the wall-clock time Durable Objects bill), covering
  the two upgrades and the broadcast. A room kept awake by its sockets would
  have accrued the whole 42 seconds.

## Rollback notes

Roll back the Worker version, then revert this change. Rooms hold no data.
Once deployed, the `BoardRoom` class stays registered; removing it for good
needs a later migration with `deleted_classes`, not just deleting the binding.

## Remaining work

- New projects are not announced to other devices until they refetch.
