import { drizzleAdapter } from "better-auth/adapters/drizzle"

import { getDb } from "@/db"
import { authSchema, oauthSchema } from "@/db/schema"

export function getAuthDatabase(database: D1Database) {
  return drizzleAdapter(getDb(database), {
    provider: "sqlite",
    schema: { ...authSchema, ...oauthSchema },
  })
}

/**
 * Whether the database has the auth tables, which the D1 migrations create.
 * A copy deployed without applying them has none.
 */
export async function hasAuthTables(database: D1Database): Promise<boolean> {
  const row = await database
    .prepare(
      "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'user'"
    )
    .first()
  return row !== null
}
