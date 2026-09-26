import { and, asc, count, eq, gt, inArray, max, sql } from "drizzle-orm"

import { getDb } from "@/db"
import { aiUsage, tasks } from "@/db/schema"
import type { Task } from "@/db/schema"

/**
 * Atomically takes one unit of the user's daily quota. Returns the new count,
 * or null when the limit is already reached.
 */
export async function reserveAiUse(
  userId: string,
  day: string,
  dailyLimit: number,
  database?: D1Database
): Promise<number | null> {
  if (dailyLimit <= 0) return null
  const db = getDb(database)
  const reserved = await db
    .insert(aiUsage)
    .values({ userId, day, count: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: { count: sql`${aiUsage.count} + 1` },
      setWhere: sql`${aiUsage.count} < ${dailyLimit}`,
    })
    .returning({ count: aiUsage.count })

  return reserved.at(0)?.count ?? null
}

/** Gives back a unit taken for work that failed before producing anything. */
export async function refundAiUse(
  userId: string,
  day: string,
  database?: D1Database
): Promise<void> {
  const db = getDb(database)
  await db
    .update(aiUsage)
    .set({ count: sql`${aiUsage.count} - 1` })
    .where(
      and(
        eq(aiUsage.userId, userId),
        eq(aiUsage.day, day),
        gt(aiUsage.count, 0)
      )
    )
}

export async function getAiUse(
  userId: string,
  day: string,
  database?: D1Database
): Promise<number> {
  const db = getDb(database)
  const row = await db.query.aiUsage.findFirst({
    columns: { count: true },
    where: and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)),
  })
  return row?.count ?? 0
}

export async function countSubtasks(
  userId: string,
  taskId: string,
  database?: D1Database
): Promise<number> {
  const db = getDb(database)
  const rows = await db
    .select({ value: count() })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.parentId, taskId)))
  return rows.at(0)?.value ?? 0
}

/**
 * Inserts generated subtasks under their parent in one statement, after the
 * last task in the Todo column. Subtask IDs come from the workflow step that
 * generated them, so a retried insert adds nothing twice.
 */
export async function insertSubtasks(
  userId: string,
  parent: { id: string; projectId: string },
  subtasks: { id: string; title: string }[],
  database?: D1Database
): Promise<Task[]> {
  const db = getDb(database)
  const last = await db
    .select({ value: max(tasks.position) })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.projectId, parent.projectId),
        eq(tasks.status, "todo")
      )
    )
  const start = (last.at(0)?.value ?? 0) + 1
  const now = Date.now()

  await db
    .insert(tasks)
    .values(
      subtasks.map((subtask, index) => ({
        id: subtask.id,
        projectId: parent.projectId,
        userId,
        parentId: parent.id,
        title: subtask.title,
        notes: null,
        status: "todo" as const,
        position: start + index,
        dueAt: null,
        reminderSentAt: null,
        createdAt: now,
        updatedAt: now,
      }))
    )
    .onConflictDoNothing()

  return db.query.tasks.findMany({
    where: and(
      eq(tasks.userId, userId),
      eq(tasks.parentId, parent.id),
      inArray(
        tasks.id,
        subtasks.map((subtask) => subtask.id)
      )
    ),
    orderBy: [asc(tasks.position)],
  })
}
