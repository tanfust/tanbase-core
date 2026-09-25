import { and, asc, count, eq, sql } from "drizzle-orm"

import { getDb } from "@/db"
import { attachments, tasks } from "@/db/schema"
import type { Attachment } from "@/db/schema"

export interface CreateAttachmentInput {
  id: string
  taskId: string
  projectId: string
  r2Key: string
  filename: string
  size: number
  contentType: string
}

export async function getTaskScope(
  userId: string,
  taskId: string,
  database?: D1Database
): Promise<{ taskId: string; projectId: string } | null> {
  const db = getDb(database)
  const task = await db.query.tasks.findFirst({
    columns: { id: true, projectId: true },
    where: and(eq(tasks.id, taskId), eq(tasks.userId, userId)),
  })

  return task ? { taskId: task.id, projectId: task.projectId } : null
}

export async function countTaskAttachments(
  userId: string,
  taskId: string,
  database?: D1Database
): Promise<number> {
  const db = getDb(database)
  const rows = await db
    .select({ value: count() })
    .from(attachments)
    .where(and(eq(attachments.userId, userId), eq(attachments.taskId, taskId)))

  return rows.at(0)?.value ?? 0
}

export async function createAttachment(
  userId: string,
  input: CreateAttachmentInput,
  database?: D1Database
): Promise<Attachment> {
  const db = getDb(database)
  const attachment: Attachment = {
    ...input,
    userId,
    createdAt: Date.now(),
  }

  await db.insert(attachments).values(attachment)

  return attachment
}

export async function listTaskAttachments(
  userId: string,
  taskId: string,
  database?: D1Database
): Promise<Attachment[]> {
  const db = getDb(database)

  return db.query.attachments.findMany({
    where: and(eq(attachments.userId, userId), eq(attachments.taskId, taskId)),
    orderBy: [asc(attachments.createdAt), asc(attachments.id)],
  })
}

export async function getAttachment(
  userId: string,
  attachmentId: string,
  database?: D1Database
): Promise<Attachment | null> {
  const db = getDb(database)
  const attachment = await db.query.attachments.findFirst({
    where: and(
      eq(attachments.id, attachmentId),
      eq(attachments.userId, userId)
    ),
  })

  return attachment ?? null
}

/** Deletes the row and returns its object key, or null when not owned. */
export async function deleteAttachment(
  userId: string,
  attachmentId: string,
  database?: D1Database
): Promise<string | null> {
  const db = getDb(database)
  const deleted = await db
    .delete(attachments)
    .where(
      and(eq(attachments.id, attachmentId), eq(attachments.userId, userId))
    )
    .returning({ r2Key: attachments.r2Key })

  return deleted.at(0)?.r2Key ?? null
}

/**
 * Object keys for a task and every descendant subtask, which the task's
 * cascading delete also removes.
 */
export async function listAttachmentKeysForTaskTree(
  userId: string,
  taskId: string,
  database?: D1Database
): Promise<string[]> {
  const db = getDb(database)
  const rows = await db.all<{ r2_key: string }>(sql`
    WITH RECURSIVE tree(id) AS (
      SELECT id FROM task WHERE id = ${taskId} AND user_id = ${userId}
      UNION ALL
      SELECT task.id FROM task
      JOIN tree ON task.parent_id = tree.id
      WHERE task.user_id = ${userId}
    )
    SELECT r2_key FROM attachment
    WHERE user_id = ${userId} AND task_id IN (SELECT id FROM tree)
  `)

  return rows.map((row) => row.r2_key)
}

export async function listAttachmentKeysForProject(
  userId: string,
  projectId: string,
  database?: D1Database
): Promise<string[]> {
  const db = getDb(database)
  const rows = await db
    .select({ r2Key: attachments.r2Key })
    .from(attachments)
    .where(
      and(eq(attachments.userId, userId), eq(attachments.projectId, projectId))
    )

  return rows.map((row) => row.r2Key)
}
