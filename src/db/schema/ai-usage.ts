import { sql } from "drizzle-orm"
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core"

// One row per user and UTC day. The primary key is the quota index: every
// check and reservation reads or writes exactly one row.
export const aiUsage = sqliteTable(
  "ai_usage",
  {
    userId: text("user_id").notNull(),
    // UTC calendar day, formatted YYYY-MM-DD.
    day: text("day").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.day] }),
    check("ai_usage_count_check", sql`${table.count} >= 0`),
  ]
)

export type AiUsage = typeof aiUsage.$inferSelect
