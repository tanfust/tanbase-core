import { z } from "zod"

/** A task is reminded once, at the first hourly run within a day of its due time. */
export const reminderWindowMs = 24 * 60 * 60 * 1000

/** Upper bound per cron run; anything beyond it is picked up an hour later. */
export const remindersPerRun = 1000

/** Queue `sendBatch()` accepts at most 100 messages per call. */
export const queueBatchLimit = 100

export const reminderMessageSchema = z.object({
  taskId: z.string().min(1),
  // The due time the message was enqueued for. A later due-date change makes
  // the message stale, so the consumer skips it.
  dueAt: z.number().int().nonnegative(),
})

export type ReminderMessage = z.infer<typeof reminderMessageSchema>

/**
 * Due dates are calendar dates stored as noon in the browser's time zone, so
 * their UTC date is the chosen date for every offset from UTC-12 to UTC+11.
 */
export function formatDueDate(dueAt: number): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(dueAt)
}
