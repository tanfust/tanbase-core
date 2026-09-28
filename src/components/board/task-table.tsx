import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  functionalUpdate,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import type {
  ColumnFiltersState,
  ColumnVisibilityState,
  SortingState,
  Updater,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  Columns3Icon,
  CornerDownRightIcon,
  FilterIcon,
  SearchIcon,
} from "lucide-react"

import { TaskDate } from "@/components/board/task-date"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  hideableTaskColumns,
  maxTaskSearchLength,
} from "@/modules/tasks/board-search"
import type {
  BoardSearch,
  HideableTaskColumn,
  SortableTaskColumn,
} from "@/modules/tasks/board-search"
import { taskStatusLabels, taskStatuses } from "@/modules/tasks/contracts"
import type { TaskStatus, TaskView } from "@/modules/tasks/contracts"

const columnLabels: Record<HideableTaskColumn | "title", string> = {
  title: "Title",
  status: "Status",
  dueAt: "Due",
  notes: "Notes",
  createdAt: "Created",
  updatedAt: "Updated",
}

const statusOrder: Record<TaskStatus, number> = { todo: 0, doing: 1, done: 2 }

/** A task as a list row, with its parent's title when it is a subtask. */
export type TaskRow = TaskView & { parentTitle: string | null }

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text },
  filterFns: { includesString: filterFn_includesString },
})

const helper = createColumnHelper<typeof features, TaskRow>()

const columns = helper.columns([
  helper.accessor("title", {
    header: columnLabels.title,
    sortFn: "text",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="flex min-w-48 flex-col gap-0.5">
        {row.original.parentTitle && (
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <CornerDownRightIcon className="size-3 shrink-0" />
            <span className="truncate">Part of {row.original.parentTitle}</span>
          </span>
        )}
        <span className="font-medium">{row.original.title}</span>
      </div>
    ),
  }),
  helper.accessor("status", {
    header: columnLabels.status,
    sortFn: (a, b) =>
      statusOrder[a.original.status] - statusOrder[b.original.status],
    // Rows whose status is one of the selected ones.
    filterFn: (row, _columnId, selected: TaskStatus[]) =>
      selected.includes(row.original.status),
    enableGlobalFilter: false,
    cell: ({ row }) => (
      <Badge variant={row.original.status === "done" ? "secondary" : "outline"}>
        {taskStatusLabels[row.original.status]}
      </Badge>
    ),
  }),
  helper.accessor((task) => task.dueAt ?? undefined, {
    id: "dueAt",
    header: columnLabels.dueAt,
    sortFn: "basic",
    // Soonest first; the other dates sort newest first.
    sortDescFirst: false,
    sortUndefined: "last",
    enableGlobalFilter: false,
    cell: ({ getValue }) => <TaskDate timestamp={getValue()} />,
  }),
  helper.accessor((task) => task.notes ?? "", {
    id: "notes",
    header: columnLabels.notes,
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="line-clamp-2 max-w-80 text-muted-foreground">
        {getValue() || "—"}
      </span>
    ),
  }),
  helper.accessor("createdAt", {
    header: columnLabels.createdAt,
    sortFn: "basic",
    enableGlobalFilter: false,
    cell: ({ getValue }) => <TaskDate timestamp={getValue()} />,
  }),
  helper.accessor("updatedAt", {
    header: columnLabels.updatedAt,
    sortFn: "basic",
    enableGlobalFilter: false,
    cell: ({ getValue }) => <TaskDate timestamp={getValue()} />,
  }),
])

type ListSearch = Pick<BoardSearch, "q" | "status" | "sort" | "desc" | "hide">

/** The table state that the URL's search params hold. */
export function tableStateFromSearch(search: ListSearch) {
  const sorting: SortingState = search.sort
    ? [{ id: search.sort, desc: search.desc }]
    : []
  const columnFilters: ColumnFiltersState = search.status.length
    ? [{ id: "status", value: search.status }]
    : []
  const columnVisibility: ColumnVisibilityState = Object.fromEntries(
    search.hide.map((column) => [column, false])
  )
  return { sorting, columnFilters, columnVisibility }
}

/** The search params that hold a change to the table's state. */
export function searchFromSorting(sorting: SortingState): Partial<ListSearch> {
  const first = sorting.at(0)
  return {
    sort: first?.id as SortableTaskColumn | undefined,
    desc: first?.desc ?? false,
  }
}

export function searchFromFilters(
  filters: ColumnFiltersState
): Partial<ListSearch> {
  const status = filters.find((filter) => filter.id === "status")?.value
  return {
    status: Array.isArray(status)
      ? taskStatuses.filter((value) => status.includes(value))
      : [],
  }
}

export function searchFromVisibility(
  visibility: ColumnVisibilityState
): Partial<ListSearch> {
  return {
    hide: hideableTaskColumns.filter((column) => visibility[column] === false),
  }
}

const searchDelay = 250

/**
 * The search box's text. It filters the table as someone types and reaches
 * the URL once they pause, so typing never waits on navigation. A change to
 * the URL from elsewhere, such as the back button, replaces it.
 */
function useSearchText(value: string, onCommit: (value: string) => void) {
  const [text, setText] = useState(value)
  const committed = useRef(value)
  const commit = useRef(onCommit)
  commit.current = onCommit

  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value
      setText(value)
    }
  }, [value])

  useEffect(() => {
    if (text === committed.current) return
    const timer = setTimeout(() => {
      committed.current = text
      commit.current(text)
    }, searchDelay)
    return () => clearTimeout(timer)
  }, [text])

  return [text, setText] as const
}

export function TaskTable({
  tasks,
  projectName,
  search,
  onSearchChange,
  renderActions,
}: {
  tasks: TaskView[]
  projectName: string
  search: ListSearch
  onSearchChange: (patch: Partial<ListSearch>) => void
  renderActions: (task: TaskView) => ReactNode
}) {
  const data = useMemo(() => {
    const titles = new Map(tasks.map((task) => [task.id, task.title]))
    return tasks.map((task) => ({
      ...task,
      parentTitle: task.parentId ? (titles.get(task.parentId) ?? null) : null,
    }))
  }, [tasks])
  const [text, setText] = useSearchText(search.q, (q) => onSearchChange({ q }))
  const state = useMemo(
    () => tableStateFromSearch(search),
    [search.sort, search.desc, search.status, search.hide]
  )

  function update<T>(current: T, updater: Updater<T>) {
    return functionalUpdate(updater, current)
  }

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.id,
    state: { ...state, globalFilter: text },
    enableMultiSort: false,
    globalFilterFn: "includesString",
    onSortingChange: (updater) =>
      onSearchChange(searchFromSorting(update(state.sorting, updater))),
    onColumnFiltersChange: (updater) =>
      onSearchChange(searchFromFilters(update(state.columnFilters, updater))),
    onColumnVisibilityChange: (updater) =>
      onSearchChange(
        searchFromVisibility(update(state.columnVisibility, updater))
      ),
    onGlobalFilterChange: (updater) => setText(update(text, updater) ?? ""),
  })

  const rows = table.getRowModel().rows
  const statusColumn = table.getColumn("status")
  const hideable = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide())
  const visibleColumns = table.getVisibleLeafColumns().length
  const filtered = search.status.length > 0 || text.length > 0

  function toggleStatus(status: TaskStatus, checked: boolean) {
    const next = checked
      ? [...search.status, status]
      : search.status.filter((value) => value !== status)
    statusColumn?.setFilterValue(next.length ? next : undefined)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:w-72">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Search tasks"
            placeholder="Search titles and notes"
            maxLength={maxTaskSearchLength}
            value={text}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
          />
        </InputGroup>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" aria-label="Filter by status" />}
          >
            <FilterIcon data-icon="inline-start" />
            Status
            {search.status.length > 0 && (
              <Badge variant="secondary">{search.status.length}</Badge>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Show status</DropdownMenuLabel>
              {taskStatuses.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={search.status.includes(status)}
                  onCheckedChange={(checked) => toggleStatus(status, checked)}
                >
                  {taskStatusLabels[status]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            <Columns3Icon data-icon="inline-start" />
            Columns
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              {hideable.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(checked) =>
                    column.toggleVisibility(checked)
                  }
                >
                  {columnLabels[column.id as HideableTaskColumn]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <p role="status" className="text-sm text-muted-foreground sm:ms-auto">
          {filtered
            ? `${rows.length} of ${tasks.length} tasks`
            : `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
        </p>
      </div>
      <div className="rounded-3xl border">
        <Table>
          <TableCaption className="sr-only">
            Tasks in {projectName}
          </TableCaption>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {header.column.getCanSort() ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ms-2.5"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUpIcon data-icon="inline-end" />
                          ) : sorted === "desc" ? (
                            <ArrowDownIcon data-icon="inline-end" />
                          ) : (
                            <ArrowUpDownIcon
                              data-icon="inline-end"
                              className="text-muted-foreground"
                            />
                          )}
                        </Button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
                <TableHead scope="col">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns + 1}
                  className="h-24 text-center text-muted-foreground"
                >
                  {tasks.length === 0
                    ? "No tasks yet. Add the first one."
                    : "No tasks match the search and filters."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                  <TableCell className="w-10 text-end">
                    {renderActions(row.original)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
