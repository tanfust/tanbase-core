import { env } from "cloudflare:workers"

import { log } from "@/platform/log"

import { queueBatchLimit, remindersPerRun } from "./reminders"
import type { ReminderMessage } from "./reminders"
import { findDueReminders } from "./repository.server"

/** The reminder queue, or null when the installation has no EMAIL_QUEUE. */
export function getReminderQueue(): Queue<ReminderMessage> | null {
  return (env as { EMAIL_QUEUE?: Queue<ReminderMessage> }).EMAIL_QUEUE ?? null
}

interface EnqueueOptions {
  queue?: Queue<ReminderMessage> | null
  database?: D1Database
}

/**
 * Runs from the hourly Cron Trigger. Enqueues one message per task due within
 * the reminder window; the consumer makes duplicates harmless, so an
 * overlapping run can safely enqueue a task again.
 */
export async function enqueueDueReminders(
  now: number,
  { queue = getReminderQueue(), database }: EnqueueOptions = {}
): Promise<number> {
  if (!queue) {
    log.warn("Reminders are not configured; no queue is bound.", {
      event: "reminders.disabled",
    })
    return 0
  }

  const due = await findDueReminders(now, database)
  for (let start = 0; start < due.length; start += queueBatchLimit) {
    await queue.sendBatch(
      due
        .slice(start, start + queueBatchLimit)
        .map((body) => ({ body, contentType: "json" }))
    )
  }

  log.info("Reminders enqueued", {
    event: "reminders.enqueued",
    count: due.length,
    truncated: due.length === remindersPerRun,
  })
  return due.length
}
