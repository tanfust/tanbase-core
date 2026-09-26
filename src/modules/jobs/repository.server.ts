import { and, asc, eq, exists, gt, isNull, lte, ne } from "drizzle-orm"

import { getDb } from "@/db"
import { projects, tasks, user } from "@/db/schema"

import { reminderWindowMs, remindersPerRun } from "./reminders"
import type { ReminderMessage } from "./reminders"

export interface ClaimedReminder {
  taskId: string
  projectId: string
  projectName: string
  taskTitle: string
  dueAt: number
  email: string
  name: string
}

/** Open tasks of verified users due within the window and not yet reminded. */
export async function findDueReminders(
  now: number,
  database?: D1Database
): Promise<ReminderMessage[]> {
  const db = getDb(database)
  const rows = await db
    .select({ taskId: tasks.id, dueAt: tasks.dueAt })
    .from(tasks)
    .innerJoin(user, eq(user.id, tasks.userId))
    .where(
      and(
        gt(tasks.dueAt, now),
        lte(tasks.dueAt, now + reminderWindowMs),
        isNull(tasks.reminderSentAt),
        ne(tasks.status, "done"),
        eq(user.emailVerified, true)
      )
    )
    .orderBy(asc(tasks.dueAt), asc(tasks.id))
    .limit(remindersPerRun)

  return rows.flatMap(({ taskId, dueAt }) =>
    dueAt === null ? [] : [{ taskId, dueAt }]
  )
}

/**
 * Marks the reminder as sent before delivery, in one conditional update, so
 * only one of any duplicate messages can claim it. Returns null when the task
 * is gone, done, already reminded, or due at a different time than the
 * message says.
 */
export async function claimReminder(
  message: ReminderMessage,
  claimedAt: number,
  database?: D1Database
): Promise<ClaimedReminder | null> {
  const db = getDb(database)
  const claimed = (
    await db
      .update(tasks)
      .set({ reminderSentAt: claimedAt })
      .where(
        and(
          eq(tasks.id, message.taskId),
          eq(tasks.dueAt, message.dueAt),
          isNull(tasks.reminderSentAt),
          ne(tasks.status, "done"),
          exists(
            db
              .select({ id: user.id })
              .from(user)
              .where(
                and(eq(user.id, tasks.userId), eq(user.emailVerified, true))
              )
          )
        )
      )
      .returning({
        taskId: tasks.id,
        projectId: tasks.projectId,
        userId: tasks.userId,
        taskTitle: tasks.title,
      })
  ).at(0)
  if (!claimed) return null

  const recipient = (
    await db
      .select({
        email: user.email,
        name: user.name,
        projectName: projects.name,
      })
      .from(user)
      .innerJoin(
        projects,
        and(eq(projects.id, claimed.projectId), eq(projects.userId, user.id))
      )
      .where(eq(user.id, claimed.userId))
  ).at(0)
  if (!recipient) return null

  return {
    taskId: claimed.taskId,
    projectId: claimed.projectId,
    projectName: recipient.projectName,
    taskTitle: claimed.taskTitle,
    dueAt: message.dueAt,
    email: recipient.email,
    name: recipient.name,
  }
}

/** Undoes this claim only, so a retry can deliver the reminder. */
export async function releaseReminder(
  taskId: string,
  claimedAt: number,
  database?: D1Database
): Promise<void> {
  const db = getDb(database)
  await db
    .update(tasks)
    .set({ reminderSentAt: null })
    .where(and(eq(tasks.id, taskId), eq(tasks.reminderSentAt, claimedAt)))
}
