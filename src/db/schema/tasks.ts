import { sql } from "drizzle-orm"
import {
  check,
  foreignKey,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

import { projects } from "./projects"

export const taskStatuses = ["todo", "doing", "done"] as const
export type TaskStatus = (typeof taskStatuses)[number]

export const tasks = sqliteTable(
  "task",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    userId: text("user_id").notNull(),
    parentId: text("parent_id"),
    title: text("title").notNull(),
    notes: text("notes"),
    status: text("status", { enum: taskStatuses }).notNull().default("todo"),
    position: real("position").notNull().default(0),
    dueAt: integer("due_at", { mode: "number" }),
    reminderSentAt: integer("reminder_sent_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    check(
      "task_status_check",
      sql`${table.status} in ('todo', 'doing', 'done')`
    ),
    uniqueIndex("task_id_project_id_user_id_unique").on(
      table.id,
      table.projectId,
      table.userId
    ),
    index("task_user_project_status_position_idx").on(
      table.userId,
      table.projectId,
      table.status,
      table.position
    ),
    index("task_due_reminder_idx").on(table.dueAt, table.reminderSentAt),
    foreignKey({
      name: "task_project_owner_fk",
      columns: [table.projectId, table.userId],
      foreignColumns: [projects.id, projects.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "task_parent_scope_fk",
      columns: [table.parentId, table.projectId, table.userId],
      foreignColumns: [table.id, table.projectId, table.userId],
    }).onDelete("cascade"),
  ]
)

export type Task = typeof tasks.$inferSelect
