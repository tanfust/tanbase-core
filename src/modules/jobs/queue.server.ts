import { env } from "cloudflare:workers"

import { sendEmail } from "@/modules/email/send-email.server"
import type { SendEmailInput } from "@/modules/email/types"
import { log } from "@/platform/log"

import { formatDueDate, reminderMessageSchema } from "./reminders"
import { claimReminder, releaseReminder } from "./repository.server"
import type { ClaimedReminder } from "./repository.server"

interface ConsumerOptions {
  /** Origin for links in the email; defaults to the configured auth URL. */
  appOrigin?: string
  database?: D1Database
  now?: () => number
  send?: (input: SendEmailInput) => Promise<unknown>
}

function reminderEmail(
  reminder: ClaimedReminder,
  appOrigin: string
): SendEmailInput {
  const due = formatDueDate(reminder.dueAt)
  const taskUrl = new URL("/app", appOrigin)
  taskUrl.searchParams.set("project", reminder.projectId)

  return {
    template: "taskReminder",
    to: reminder.email,
    subject: `Reminder: ${reminder.taskTitle} is due ${due}`,
    props: {
      dueAt: `on ${due}`,
      name: reminder.name,
      projectName: reminder.projectName,
      taskTitle: reminder.taskTitle,
      taskUrl: taskUrl.href,
    },
  }
}

/**
 * Queue consumer for due-date reminders. Each reminder is claimed in D1 before
 * delivery, so a duplicate message never sends a second email. A failed
 * delivery releases the claim and retries; after the configured retries the
 * message moves to the dead-letter queue. A crash between claim and delivery
 * drops that reminder rather than risking a duplicate.
 */
export async function processReminderBatch(
  batch: MessageBatch<unknown>,
  {
    appOrigin = new URL(env.BETTER_AUTH_URL).origin,
    database,
    now = Date.now,
    send = sendEmail,
  }: ConsumerOptions = {}
): Promise<void> {
  for (const message of batch.messages) {
    const parsed = reminderMessageSchema.safeParse(message.body)
    if (!parsed.success) {
      log.warn("Discarded an invalid reminder message.", {
        event: "reminders.invalid",
        messageId: message.id,
      })
      message.ack()
      continue
    }

    const claimedAt = now()
    let claimed: ClaimedReminder | null = null
    try {
      claimed = await claimReminder(parsed.data, claimedAt, database)
      if (!claimed) {
        log.info("Reminder skipped", {
          event: "reminders.skipped",
          taskId: parsed.data.taskId,
        })
        message.ack()
        continue
      }

      await send(reminderEmail(claimed, appOrigin))
      log.info("Reminder sent", {
        event: "reminders.sent",
        taskId: claimed.taskId,
      })
      message.ack()
    } catch (error) {
      if (claimed) {
        await releaseReminder(claimed.taskId, claimedAt, database).catch(() => {
          log.error("Could not release a reminder claim.", {
            event: "reminders.release_failed",
            taskId: parsed.data.taskId,
          })
        })
      }
      log.warn("Reminder delivery failed; it will be retried.", {
        event: "reminders.failed",
        taskId: parsed.data.taskId,
        attempts: message.attempts,
        error: error instanceof Error ? error.message : "Unknown error",
      })
      message.retry()
    }
  }
}
