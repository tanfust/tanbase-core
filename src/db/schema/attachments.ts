import { sql } from "drizzle-orm"
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

import { maxAttachmentBytes } from "@/modules/files/limits"

import { tasks } from "./tasks"

export const attachments = sqliteTable(
  "attachment",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull(),
    // Denormalized so project deletion can find its objects, and so the
    // composite key below proves the task, project, and owner agree.
    projectId: text("project_id").notNull(),
    userId: text("user_id").notNull(),
    r2Key: text("r2_key").notNull(),
    filename: text("filename").notNull(),
    size: integer("size", { mode: "number" }).notNull(),
    contentType: text("content_type").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    check(
      "attachment_size_check",
      sql`${table.size} > 0 and ${table.size} <= ${sql.raw(String(maxAttachmentBytes))}`
    ),
    uniqueIndex("attachment_r2_key_unique").on(table.r2Key),
    index("attachment_user_task_created_idx").on(
      table.userId,
      table.taskId,
      table.createdAt
    ),
    index("attachment_user_project_idx").on(table.userId, table.projectId),
    foreignKey({
      name: "attachment_task_owner_fk",
      columns: [table.taskId, table.projectId, table.userId],
      foreignColumns: [tasks.id, tasks.projectId, tasks.userId],
    }).onDelete("cascade"),
  ]
)

export type Attachment = typeof attachments.$inferSelect
