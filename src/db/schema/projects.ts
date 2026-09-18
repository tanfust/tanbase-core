import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

export const projects = sqliteTable(
  "project",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("project_id_user_id_unique").on(table.id, table.userId),
    index("project_user_created_idx").on(
      table.userId,
      table.createdAt,
      table.id
    ),
  ]
)

export type Project = typeof projects.$inferSelect
