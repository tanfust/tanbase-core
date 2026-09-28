---
status: active
audience: contributors, maintainers, agents
last_verified: 2026-09-28
---

# 2026-09-28: The task status label, and what AI costs a deployment

## Summary

The task dialog shows a task's status as its label, such as "Doing", instead
of its stored value, `doing`. A deployment's owner now sees that task
breakdown runs on their account's Workers AI and what it costs: the button's
setup page describes the three `AI_*` variables, `pnpm run deploy` ends its
log with an `AI task breakdown:` line, and the README and DEPLOYMENT say how
it is billed and how to turn it off.

## Motivation

- The outside tester's working copy showed `doing` in the task dialog's
  status field. The Base UI select showed the value because it had no map
  from values to labels.
- Task breakdown was on in the tester's deployment, calling Workers AI on
  their account, and nothing they saw said so. The README listed Workers AI
  only as a cost risk.

## Behavior and configuration changes

- **Task dialog:** `src/components/board/task-dialog.tsx` passes
  `items={taskStatusLabels}` to the status select and renders its options
  from `taskStatuses`.
- **Deploy log:** `aiSummary()` in `scripts/deploy-resources.mjs` reads the
  generated configuration. `scripts/deploy.mjs` prints either
  `AI task breakdown: off.` or, when it is on, the model, the gateway, the
  daily limit per person, that the account is billed after its free daily
  Neurons, and how to turn it off.
- **Setup page:** `package.json` `cloudflare.bindings` describes `AI_MODEL`
  (what it costs), `AI_GATEWAY_ID`, and `AI_DAILY_LIMIT` (0 turns it off).
- **Docs:** the README's Deploy to Cloudflare section and DEPLOYMENT's AI
  section cover billing and turning breakdown off.
- **Records:** STATUS, FEATURES, and the
  [previous change record](2026-09-28-first-deploy-without-setup.md) record
  the deploy of `197cbbb` and the tester's first working deploy.

## Migrations and environment changes

None.

## Validation evidence

Local:

- A UI test renders the dialog with the status `doing` and expects "Doing" in
  the trigger. It failed with the fix removed and passes with it.
- A script test covers `aiSummary()` with breakdown on, with a limit of 0,
  and without the `ai` binding.
- `pnpm verify` without `.dev.vars`: 249 Worker tests, 42 UI tests, 40 setup
  tests, and 32 script tests passed, with format, lint, docs, schema, types,
  boundaries, and build.
- On the top-level build that verify produced, `aiSummary()` printed the
  "on" line with `@cf/mistralai/mistral-small-3.1-24b-instruct`, the gateway
  `default`, and a limit of 20 a day per person.
- `pnpm test:e2e` with the system Chrome: 5 passed.

## Deployment state

| Target     | Commit | URL                        | Date       | Result       |
| ---------- | ------ | -------------------------- | ---------- | ------------ |
| Local      | branch | —                          | 2026-09-28 | Passed       |
| Production | —      | `https://core.tanbase.dev` | —          | Not deployed |

## Rollback notes

Revert the merge.

## Remaining work

- The first button run and the timed fresh-account test (F-023).
