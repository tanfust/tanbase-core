// The router loads every route's options with the first page, so this
// schema ships with the landing page. Zod Mini keeps its share small.
import * as z from "zod/mini"

import "@/lib/zod-config"

import { taskStatuses } from "./contracts"

/** The ways `/app` shows a project's tasks. */
export const boardViews = ["board", "list", "stats"] as const
export type BoardView = (typeof boardViews)[number]

/** The list view's columns that sort. */
export const sortableTaskColumns = [
  "title",
  "status",
  "dueAt",
  "createdAt",
  "updatedAt",
] as const
export type SortableTaskColumn = (typeof sortableTaskColumns)[number]

/** The list view's columns a person may hide; the title always shows. */
export const hideableTaskColumns = [
  "status",
  "dueAt",
  "notes",
  "createdAt",
  "updatedAt",
] as const
export type HideableTaskColumn = (typeof hideableTaskColumns)[number]

/**
 * The values `/app` shows without search params. The router strips them from
 * links, so a shared URL carries only what differs from the default view.
 */
export const boardSearchDefaults = {
  view: "board" as BoardView,
  q: "",
  status: [] as Array<(typeof taskStatuses)[number]>,
  desc: false,
  hide: [] as HideableTaskColumn[],
}

/**
 * `/app`'s search params: the project, the view, and the list view's search,
 * status filter, sort, and hidden columns. A malformed value falls back to
 * its default instead of failing the page, so an edited link still opens.
 */
export const boardSearchSchema = z.object({
  project: z.catch(z.optional(z.string().check(z.minLength(1))), undefined),
  view: z.catch(z._default(z.enum(boardViews), "board"), "board"),
  q: z.catch(z._default(z.string().check(z.maxLength(100)), ""), ""),
  status: z.catch(z._default(z.array(z.enum(taskStatuses)), []), []),
  sort: z.catch(z.optional(z.enum(sortableTaskColumns)), undefined),
  desc: z.catch(z._default(z.boolean(), false), false),
  hide: z.catch(z._default(z.array(z.enum(hideableTaskColumns)), []), []),
})

export type BoardSearch = z.output<typeof boardSearchSchema>
