import { env } from "cloudflare:workers"
import { drizzle } from "drizzle-orm/d1"

import * as schema from "./schema"

function createDb(database: D1Database) {
  return drizzle(database, { schema })
}

// Building an instance walks the whole schema for the relational query API,
// and a render calls getDb() once per query, so each binding gets one.
const instances = new WeakMap<D1Database, Database>()

export function getDb(database: D1Database = env.DB): Database {
  let db = instances.get(database)
  if (!db) {
    db = createDb(database)
    instances.set(database, db)
  }
  return db
}

export type Database = ReturnType<typeof createDb>
