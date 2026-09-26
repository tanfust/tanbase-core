---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-26
---

# 2026-09-26: AI task breakdown on Workers AI, AI Gateway, and Workflows

## Summary

Added F-013 and F-014. **Break down with AI** on a task starts
`TaskBreakdownWorkflow`, which asks Workers AI through AI Gateway for 3 to 7
subtasks, validates them, inserts them under the task, and broadcasts them to
the live board, behind a per-user daily quota and a burst limit.

## Motivation

Workers AI, AI Gateway, and Workflows are the remaining Cloudflare products on
the launch path, and the demo guardrails (F-022) depend on this feature.

## Behavior and configuration changes

- New `src/modules/ai/`:
  - `subtasks.ts`: the prompt, the JSON Schema sent to the model, and Zod
    validation of the reply (3 to 7 titles of up to 200 characters, code
    fences stripped, duplicates dropped).
  - `model.server.ts`: calls `AI_MODEL` through the `AI_GATEWAY_ID` gateway,
    skipping the cache and tagging the log with the feature and task ID.
  - `repository.server.ts`: the atomic quota reservation (one conditional
    upsert), refunds, usage reads, subtask counts, and the one-statement
    subtask insert.
  - `breakdown-workflow.server.ts`: the steps load task → generate subtasks
    (two retries) → insert subtasks → broadcast. A run that fails before
    inserting refunds its quota and ends with the user-facing message.
  - `breakdown.server.ts` and server functions: availability and usage,
    starting a run, and owner-scoped status.
- New `ai_usage` table (migration `0003`), keyed on user and UTC day.
- Configuration: `AI_MODEL`, `AI_GATEWAY_ID` (`default`), and
  `AI_DAILY_LIMIT` (20) everywhere; `AI_LIMITER` (5 per 60 seconds);
  the `BREAKDOWN` Workflow (`tanbase-core-task-breakdown` in production). The
  `AI` binding is production-only
  ([ADR-0013](../decisions/0013-workers-ai-model-and-gateway.md)).
- The board shows **Break down with AI** in the menu of top-level tasks
  without subtasks when AI is available, a "Breaking down…" status on the card
  while the run polls, and a toast with the result. Subtasks show "Part of"
  their parent, and parents show a subtask count.
- `broadcastBoardEvents` awaits delivery for callers without a request, such
  as workflow steps.
- The guided installer renames the Workflow to `<worker-name>-task-breakdown`.
- Vitest runs with `remoteBindings: false`.
- Fixed a race from F-011: when a new task's realtime echo arrived before the
  create response, the board briefly held two copies of the task.
- ESLint ignores `output/`, the gitignored Playwright reports, so a local
  browser run no longer breaks `pnpm lint`.
- Restored `@playwright/test` 1.55.1. A background session had upgraded it to
  1.63.0 in this checkout, and the change was committed by accident with the
  F-012 evidence in PR #18.

## Migrations and environment changes

Migration `0003_happy_korvac.sql` creates `ai_usage`; it is additive and
applied by the deploy command. No secret or resource is needed: the Workflow is
created on deployment and the `default` AI Gateway on the first call. Worker
types were regenerated.

## Validation evidence

Local:

- Model choice: the benchmark in ADR-0013, run through the account's Workers
  AI API on 2026-09-26.
- `pnpm verify` — passed.
- `src/modules/ai/subtasks.test.ts` — 13 tests with malformed-output fixtures.
  `src/modules/ai/ai.server.test.ts` — 9 tests: quota reservation, limits and
  refunds, availability, the start guards and messages, refund when a run
  cannot be created, owner-scoped status, and two Workflow runs through
  `introspectWorkflowInstance` (mocked generation completes with three
  subtasks; failing generation refunds and errors with the user message).
- `pnpm test:e2e` — both browser tests passed with AI unavailable locally;
  realtime create 4 ms and move 5 ms.
- `pnpm test:dev-client` — 76 client modules loaded.
- Real run: on the browser-test server with a temporary
  `"ai": { "binding": "AI", "remote": true }`, the verified test account broke
  down "Launch the TanBase landing page". The card showed "Breaking down…",
  seven specific subtasks arrived with "Part of" labels, the parent showed
  "7 subtasks", and the menu item disappeared from the parent and subtasks.
  `ai_usage` recorded one use. The call created the account's `default` AI
  Gateway at 10:33:16 UTC, and its log shows
  `mistral-small-3.1-24b-instruct`, 98 input and 77 output tokens, 2.6
  seconds, $0.000077, and the `task-breakdown` metadata.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result       |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------------ |
| Local      | Working tree based on `240d88d` | `http://localhost:3110`    | 2026-09-26 | Passed       |
| Production | —                               | `https://core.tanbase.dev` | —          | Not deployed |

## Rollback notes

Roll back the Worker version, or set `AI_DAILY_LIMIT` to `0` to turn the
feature off without a deploy of code. `ai_usage` can stay; nothing else reads
it. Subtasks created by breakdowns are ordinary tasks.

## Remaining work

- Deploy and run a production breakdown on `core.tanbase.dev`.
- Show the remaining daily quota in the UI.
