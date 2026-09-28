// The router loads every route's options with the first page, the landing
// page included, so `/app`'s search params are parsed here by hand. A Zod
// schema here put Zod's core on the landing page and cost it about 14 KB and
// its Lighthouse score.
import type { SearchSchemaInput } from "@tanstack/react-router"

import { taskStatuses } from "./contracts"
import type { TaskStatus } from "./contracts"

/** The longest list search the URL keeps; the search box stops there too. */
export const maxTaskSearchLength = 100

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
  status: [] as TaskStatus[],
  desc: false,
  hide: [] as HideableTaskColumn[],
}

/** `/app`'s search params, parsed. */
export interface BoardSearch {
  project?: string
  view: BoardView
  q: string
  status: TaskStatus[]
  sort?: SortableTaskColumn
  desc: boolean
  hide: HideableTaskColumn[]
}

/** What a link to `/app` may set; every param is optional. */
export type BoardSearchInput = Partial<BoardSearch>

function oneOf<T extends string>(
  values: readonly T[],
  value: unknown
): T | undefined {
  return values.find((candidate) => candidate === value)
}

/** Every item is one of `values`, or the list is not kept at all. */
function allOf<T extends string>(values: readonly T[], value: unknown): T[] {
  if (!Array.isArray(value)) return []
  const kept = value.flatMap((item) => oneOf(values, item) ?? [])
  return kept.length === value.length ? kept : []
}

/**
 * `/app`'s search params: the project, the view, and the list view's search,
 * status filter, sort, and hidden columns. A malformed value falls back to
 * its default instead of failing the page, so an edited link still opens.
 * The router has already decoded JSON values, such as arrays and booleans.
 */
export function parseBoardSearch(
  search: BoardSearchInput & SearchSchemaInput
): BoardSearch {
  const raw = search as Record<string, unknown>
  const { project, q } = raw
  return {
    project: typeof project === "string" && project ? project : undefined,
    view: oneOf(boardViews, raw.view) ?? boardSearchDefaults.view,
    q: typeof q === "string" && q.length <= maxTaskSearchLength ? q : "",
    status: allOf(taskStatuses, raw.status),
    sort: oneOf(sortableTaskColumns, raw.sort),
    desc: raw.desc === true,
    hide: allOf(hideableTaskColumns, raw.hide),
  }
}
