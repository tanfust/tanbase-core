import { drizzleAdapter } from "better-auth/adapters/drizzle"

import { getDb } from "@/db"
import { authSchema } from "@/db/schema"

export function getAuthDatabase(database: D1Database) {
  return drizzleAdapter(getDb(database), {
    provider: "sqlite",
    schema: authSchema,
  })
}
