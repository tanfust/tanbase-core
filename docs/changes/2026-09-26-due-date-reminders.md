---
status: active
audience: contributors, maintainers, operators, agents
last_verified: 2026-09-26
---

# 2026-09-26: Due-date reminders on Cron Triggers and Queues

## Summary

Added F-012. An hourly Cron Trigger enqueues one message per task due within
24 hours, and the Worker's queue consumer emails each reminder at most once,
retrying failed deliveries before moving them to a dead-letter queue.

## Motivation

Reminders are the jobs slice of the launch path: the first use of Cron
Triggers and Queues in the template, built on the existing email module and
the `reminder_sent_at` column that shipped with the task schema.

## Behavior and configuration changes

- `src/server.ts` adds `scheduled`, which calls `enqueueDueReminders`, and
  `queue`, which calls `processReminderBatch`.
- `src/modules/jobs/repository.server.ts` selects open tasks of verified users
  with `due_at` in the next 24 hours and no `reminder_sent_at`, at most 1,000
  per run, ordered by due time. The cron sends them in batches of 100 as
  `{ taskId, dueAt }` JSON messages.
- The consumer claims each reminder with one conditional update and sends the
  `taskReminder` email only when the claim succeeds. Stale messages (due date
  since changed), finished or deleted tasks, unverified owners, repeated
  messages, and invalid bodies are acknowledged without sending. A failed send
  releases the claim and calls `retry()`; the consumer retries after 120
  seconds and dead-letters after three retries
  ([ADR-0012](../decisions/0012-at-most-once-reminders.md)).
- `updateTask` clears `reminder_sent_at` only when the due date changes.
- The reminder email names the due date ("on Saturday, January 10"), links to
  the project's board, and explains in its footer why it was sent and how to
  skip it. The email shell gained an optional footer; other templates keep
  theirs.
- The guided installer creates or reuses `<worker-name>-email` and
  `<worker-name>-email-dlq`, renames them in the production configuration, and
  can continue without reminders, which removes the production queue binding
  and empties the cron list. It now also documents removing the placement
  hint for another database.

## Migrations and environment changes

No database migration: `reminder_sent_at` and `task_due_reminder_idx` already
exist. Every Wrangler configuration gains the `EMAIL_QUEUE` producer, its
consumer, and the hourly cron; local and browser-test queues are simulated.
Worker types were regenerated. Production needs two queues created before the
deployment:

```sh
pnpm exec wrangler queues create tanbase-core-email
pnpm exec wrangler queues create tanbase-core-email-dlq
```

## Validation evidence

Local:

- `pnpm verify` — passed.
- `src/modules/jobs/jobs.server.test.ts` — 7 tests: the cron window and
  filters, batching 101 messages as 100 and 1, the disabled path, duplicate
  messages sending one email, a failed send releasing its claim and succeeding
  on retry, skipped messages, and date formatting. The task repository test
  covers clearing `reminder_sent_at` only for a changed due date.
- `pnpm test:setup` — 23 tests, including queue personalization and removal.
- `pnpm test:e2e` — both browser tests passed with the queue and cron in the
  browser-test configuration; the second page saw a new task and a move 5 ms
  after the first.
- `vite dev` with a seeded verified user and a task due in three hours:
  `GET /cdn-cgi/handler/scheduled` logged `reminders.enqueued`, then
  `email.logged` and `reminders.sent` from the consumer, and D1 recorded
  `reminder_sent_at`.

Production:

- The operator created `tanbase-core-email` and `tanbase-core-email-dlq`
  before the merge. Workers Build `34bb2c71` deployed merge `c685ee5` as
  version `cb0ad7be` at 09:55:15 UTC with `schedule: 0 * * * *`; its
  post-deploy smoke passed on the first attempt. The queue lists
  `tanbase-core` as producer and consumer, with `max_retries: 3`,
  `retry_delay: 120`, and the dead-letter queue attached.
- At the 10:00 UTC run the scheduled handler logged `reminders.enqueued` with
  `count: 1`, and eight seconds later the consumer logged `reminders.sent`.
  D1 recorded `reminder_sent_at` for that one task, and no due task remained
  unreminded. The log entries carry the event and task ID only.
- The operator received "Reminder: asd is due Saturday, September 26" from
  `TanBase Core <noreply@send.tanbase.dev>` at 11:00 local time, linking to
  the task's board.

## Deployment state

| Target     | Commit                          | URL                        | Date       | Result |
| ---------- | ------------------------------- | -------------------------- | ---------- | ------ |
| Local      | Working tree based on `bbcd2e5` | `http://localhost:3112`    | 2026-09-26 | Passed |
| Production | `c685ee5` / version `cb0ad7be`  | `https://core.tanbase.dev` | 2026-09-26 | Passed |

## Rollback notes

Roll back the Worker version, or remove the production `queues` block and set
`"triggers": { "crons": [] }`, then deploy. The queues hold only task IDs and
due times and can be deleted afterwards. `reminder_sent_at` values stay valid.

## Remaining work

- Reminders have no per-user opt-out; clearing a due date or finishing the
  task skips one.
