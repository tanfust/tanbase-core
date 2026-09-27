import { z } from "zod"

import { taskStatuses } from "./contracts"

/** The ways `/app` shows a project's tasks. */
export const boardViews = ["board", "list"] as const
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
  project: z.string().min(1).optional().catch(undefined),
  view: z.enum(boardViews).default("board").catch("board"),
  q: z.string().max(100).default("").catch(""),
  status: z.array(z.enum(taskStatuses)).default([]).catch([]),
  sort: z.enum(sortableTaskColumns).optional().catch(undefined),
  desc: z.boolean().default(false).catch(false),
  hide: z.array(z.enum(hideableTaskColumns)).default([]).catch([]),
})

export type BoardSearch = z.output<typeof boardSearchSchema>
