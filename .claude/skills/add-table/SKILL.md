---
name: add-table
description: Add a user-owned D1 table to TanBase Core with a Drizzle schema, a generated migration, an ownership-scoped repository, server functions, query options, and tests. Use when a feature needs to store new data, such as "add a labels table", "store notes per task", or "persist user settings".
---

# Add a user-owned table

Read `AGENTS.md` first, especially the ownership rule. The examples below
mirror `projects` and `tasks` (`src/db/schema/projects.ts`,
`src/modules/tasks/`) and `attachments` for a child table
(`src/db/schema/attachments.ts`, `src/modules/files/repository.server.ts`).

Replace `widget` with the real name: singular for the SQL table (`widget`),
plural for the Drizzle export (`widgets`).

Put the table in the module that owns its feature. A table for a new feature
gets a new module under `src/modules/<module>/`, laid out as the `add-module`
skill describes, and a row in the `AGENTS.md` module map.

## 1. Schema

Create `src/db/schema/widgets.ts`:

```ts
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

export const widgets = sqliteTable(
  "widget",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    // Lets child tables reference (id, user_id) so owners cannot disagree.
    uniqueIndex("widget_id_user_id_unique").on(table.id, table.userId),
    // Every read filters by user first; the ID breaks ties in ordering.
    index("widget_user_created_idx").on(
      table.userId,
      table.createdAt,
      table.id
    ),
  ]
)

export type Widget = typeof widgets.$inferSelect
```

Rules:

- `id` is text and the server generates it with `crypto.randomUUID()`.
- `user_id` is `notNull`. Every index used by reads starts with it.
- Times are integer milliseconds from `Date.now()`, named `created_at` and
  `updated_at`.
- A child of another user-owned table stores `user_id` too and uses a
  composite foreign key that includes it, like `attachment_task_owner_fk`.
  Choose `onDelete("cascade")` only when deleting the parent must delete the
  child.
- Put value limits in a `check()` constraint when the database must enforce
  them, as `attachment_size_check` does.
- A column with a fixed set of values gets a `check()` constraint too, like
  `task_status_check`. Define the values once in the module's `contracts.ts`,
  which the UI may import, and import them into the schema, as
  `attachments.ts` imports its size limit from `src/modules/files/limits.ts`.
- Length limits on text usually live only in the Zod schema, as task titles
  and project names do. Add a database check only when other writers exist.

Export it from `src/db/schema/index.ts`:

```ts
export * from "./widgets"
```

## 2. Migration

```sh
pnpm db:generate
pnpm db:check
pnpm db:migrate:local
```

`db:generate` also formats the generated snapshot and journal, which
`pnpm verify` checks. Commit the SQL, the snapshot, and the journal together.

Read the new SQL in `drizzle/migrations/`. It must only add: a new table,
nullable or defaulted columns, or indexes. Production applies migrations
before the new code deploys, so the running version must keep working against
the new schema. Split a rename or drop into an additive change now and a
cleanup migration after the code no longer uses the old shape. Never edit or
delete a migration that has been merged.

If drizzle-kit asks whether a column was renamed, stop: the change is not
additive.

## 3. Repository

Create or extend `src/modules/<module>/repository.server.ts`. It is the only
place outside `src/db/` that may call `getDb()`; `pnpm test:boundaries`
enforces this.

```ts
import { and, asc, eq } from "drizzle-orm"

import { getDb } from "@/db"
import { widgets } from "@/db/schema"
import type { Widget } from "@/db/schema"

export async function createWidget(
  userId: string,
  input: { name: string },
  database?: D1Database
): Promise<Widget> {
  const db = getDb(database)
  const now = Date.now()
  const widget: Widget = {
    id: crypto.randomUUID(),
    userId,
    name: input.name,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(widgets).values(widget)
  return widget
}

export async function listWidgets(
  userId: string,
  database?: D1Database
): Promise<Widget[]> {
  const db = getDb(database)
  return db.query.widgets.findMany({
    where: eq(widgets.userId, userId),
    orderBy: [asc(widgets.createdAt), asc(widgets.id)],
  })
}

export async function renameWidget(
  userId: string,
  widgetId: string,
  name: string,
  database?: D1Database
): Promise<Widget | null> {
  const db = getDb(database)
  const updated = await db
    .update(widgets)
    .set({ name, updatedAt: Date.now() })
    .where(and(eq(widgets.id, widgetId), eq(widgets.userId, userId)))
    .returning()
  return updated.at(0) ?? null
}

export async function deleteWidget(
  userId: string,
  widgetId: string,
  database?: D1Database
): Promise<boolean> {
  const db = getDb(database)
  const deleted = await db
    .delete(widgets)
    .where(and(eq(widgets.id, widgetId), eq(widgets.userId, userId)))
    .returning({ id: widgets.id })
  return deleted.length > 0
}
```

Rules:

- `userId` is always the first argument, and every `where` includes it.
- The optional last `database` argument lets tests pass `env.DB`.
- Another user's row returns `null`, `[]`, or `false`. Never throw in a way
  that tells the caller the row exists.
- Order lists deterministically, with the ID as the tiebreaker.

## 4. Server functions

`src/modules/<module>/schemas.ts` validates input with Zod. Trim strings and
bound their length:

```ts
export const createWidgetInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
})
```

`contracts.ts` holds the view type the UI receives. Never send `userId` to
the client.

`functions.server.ts` resolves the user from the session, calls the
repository, and maps each row to its view by copying fields one by one.
Returning the row itself would leak `userId` and internal columns at runtime,
even though the view type hides them:

```ts
import { getRequestHeaders } from "@tanstack/react-start/server"

import type { Widget } from "@/db/schema"
import { getSessionFromHeaders } from "@/modules/auth/session.server"

import type { WidgetView } from "./contracts"
import { renameWidget } from "./repository.server"

async function requireUserId() {
  const session = await getSessionFromHeaders(getRequestHeaders())
  if (!session) throw new Error("Unauthorized")
  return session.user.id
}

function toWidgetView(widget: Widget): WidgetView {
  return {
    id: widget.id,
    name: widget.name,
    createdAt: widget.createdAt,
    updatedAt: widget.updatedAt,
  }
}

export async function renameWidgetImpl(input: {
  widgetId: string
  name: string
}) {
  const userId = await requireUserId()
  const widget = await renameWidget(userId, input.widgetId, input.name)
  if (!widget) throw new Error("Widget not found")
  return toWidgetView(widget)
}
```

`functions.ts` stays unsuffixed so routes can import it. Each handler imports
its implementation dynamically, which keeps server code out of the client
bundle:

```ts
export const renameWidget = createServerFn({ method: "POST" })
  .validator(renameWidgetInputSchema)
  .handler(async ({ data }) => {
    const { renameWidgetImpl } = await import("./functions.server")
    return renameWidgetImpl(data)
  })
```

Use `GET` for reads and `POST` for writes. `queries.ts` exports
`queryOptions` for reads; components invalidate that key after a mutation, as
`src/components/board/task-attachments.tsx` does.

## 5. Tests

Add `src/modules/<module>/repository.server.test.ts`. Each test file gets its
own D1 database with every migration applied:

```ts
import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

describe("widget repository", () => {
  it("creates, lists, renames, and deletes a user's widgets", async () => {
    const widget = await createWidget("owner", { name: "First" }, env.DB)
    expect(await listWidgets("owner", env.DB)).toEqual([widget])
    // ...rename, then delete, then list is empty
  })

  it("hides one user's widgets from another", async () => {
    const widget = await createWidget("owner", { name: "Private" }, env.DB)

    expect(await listWidgets("stranger", env.DB)).toEqual([])
    expect(await renameWidget("stranger", widget.id, "x", env.DB)).toBeNull()
    expect(await deleteWidget("stranger", widget.id, env.DB)).toBe(false)
    expect(await listWidgets("owner", env.DB)).toEqual([widget])
  })
})
```

Also cover each Zod schema's limits in `schemas.test.ts`.

Tests call the repository with `env.DB`. They cannot import `getDb()`, because
`pnpm test:boundaries` allows it only in `src/db/` and `repository.server.ts`.
Insert a raw fixture row with D1 itself:

```ts
await env.DB.prepare(
  "INSERT INTO widget (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
)
  .bind("w-1", "owner", "Fixed", 1, 1)
  .run()
```

Run one file while iterating:

```sh
pnpm exec vitest run src/modules/<module>/repository.server.test.ts
```

Tests must not depend on the ignored `.dev.vars`; CI has no secrets. Code that
needs Better Auth builds it with `createAuth()` and a test secret, as
`src/modules/auth/auth.server.test.ts` does.

## 6. Optional seed data

For local fixtures, append to `scripts/seed.sql` with stable IDs and
`INSERT OR IGNORE`, owned by `local-user`.

## 7. Finish

- Add the table to the core entities in `docs/OVERVIEW.md`, and a new module
  to the `AGENTS.md` module map.
- Add a change record from `docs/changes/TEMPLATE.md` and list it in
  `docs/changes/README.md`.
- Run `pnpm verify`. It runs `db:check`, the boundary checks, and every test.
- Production applies the migration during the Workers Build deploy. Follow
  the `deploy` skill after merge.
