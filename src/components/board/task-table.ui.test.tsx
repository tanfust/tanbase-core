import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  boardSearchDefaults,
  maxTaskSearchLength,
} from "@/modules/tasks/board-search"
import type { BoardSearch } from "@/modules/tasks/board-search"
import type { TaskView } from "@/modules/tasks/contracts"

import {
  TaskTable,
  searchFromFilters,
  searchFromSorting,
  searchFromVisibility,
  tableStateFromSearch,
} from "./task-table"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function task(overrides: Partial<TaskView> & Pick<TaskView, "id" | "title">) {
  return {
    projectId: "project-1",
    parentId: null,
    notes: null,
    status: "todo",
    position: 0,
    dueAt: null,
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  } satisfies TaskView
}

const tasks: TaskView[] = [
  task({ id: "a", title: "Alpha", status: "doing", dueAt: 3_000 }),
  task({ id: "b", title: "Beta", status: "done", notes: "setup guide" }),
  task({ id: "c", title: "Gamma", status: "todo", dueAt: 2_000 }),
  task({ id: "d", title: "Delta", parentId: "a" }),
]

type ListSearch = Pick<BoardSearch, "q" | "status" | "sort" | "desc" | "hide">

function renderTable(search: Partial<ListSearch> = {}) {
  const onSearchChange = vi.fn()
  render(
    <TaskTable
      tasks={tasks}
      projectName="Launch"
      search={{ ...boardSearchDefaults, sort: undefined, ...search }}
      onSearchChange={onSearchChange}
      renderActions={(row) => (
        <button type="button">Actions {row.title}</button>
      )}
    />
  )
  return { onSearchChange }
}

function titles() {
  const [, body] = screen.getAllByRole("rowgroup")
  return within(body)
    .getAllByRole("row")
    .map((row) => within(row).getAllByRole("cell")[0].textContent)
}

describe("TaskTable", () => {
  it("renders the board's tasks with subtasks under their parent's name", () => {
    renderTable()
    expect(screen.getByRole("table", { name: "Tasks in Launch" })).toBeTruthy()
    expect(titles()).toEqual(["Alpha", "Beta", "Gamma", "Part of AlphaDelta"])
    expect(screen.getByText("4 tasks")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Actions Beta" })).toBeTruthy()
  })

  it("sorts from the URL and asks the URL to change the sort", () => {
    const { onSearchChange } = renderTable({ sort: "dueAt", desc: false })
    // Tasks without a due date sort last.
    expect(titles().slice(0, 2)).toEqual(["Gamma", "Alpha"])
    const due = screen.getByRole("columnheader", { name: /due/i })
    expect(due.getAttribute("aria-sort")).toBe("ascending")

    fireEvent.click(within(due).getByRole("button"))
    expect(onSearchChange).toHaveBeenCalledWith({ sort: "dueAt", desc: true })

    fireEvent.click(
      within(screen.getByRole("columnheader", { name: /status/i })).getByRole(
        "button"
      )
    )
    expect(onSearchChange).toHaveBeenLastCalledWith({
      sort: "status",
      desc: false,
    })
  })

  it("filters by status and hides columns from the URL", () => {
    renderTable({ status: ["done", "doing"], hide: ["notes", "updatedAt"] })
    expect(titles()).toEqual(["Alpha", "Beta"])
    expect(screen.getByText("2 of 4 tasks")).toBeTruthy()
    expect(screen.queryByRole("columnheader", { name: "Notes" })).toBeNull()
    expect(screen.queryByRole("columnheader", { name: /updated/i })).toBeNull()
    expect(screen.getByRole("columnheader", { name: /created/i })).toBeTruthy()
  })

  it("searches titles and notes as someone types, then updates the URL", () => {
    vi.useFakeTimers()
    const { onSearchChange } = renderTable()
    fireEvent.change(screen.getByRole("searchbox", { name: "Search tasks" }), {
      target: { value: "guide" },
    })
    expect(titles()).toEqual(["Beta"])
    expect(onSearchChange).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(300))
    expect(onSearchChange).toHaveBeenCalledWith({ q: "guide" })
  })

  it("stops the search at the length the URL keeps", () => {
    renderTable()
    const box = screen.getByRole<HTMLInputElement>("searchbox", {
      name: "Search tasks",
    })
    expect(box.maxLength).toBe(maxTaskSearchLength)
  })

  it("says when nothing matches", () => {
    renderTable({ q: "nothing like this" })
    expect(
      screen.getByText("No tasks match the search and filters.")
    ).toBeTruthy()
  })
})

describe("table state in the URL", () => {
  it("round-trips sorting, filters, and visibility", () => {
    const search = {
      ...boardSearchDefaults,
      sort: "title" as const,
      desc: true,
      status: ["todo" as const],
      hide: ["notes" as const],
    }
    const state = tableStateFromSearch(search)
    expect(searchFromSorting(state.sorting)).toEqual({
      sort: "title",
      desc: true,
    })
    expect(searchFromFilters(state.columnFilters)).toEqual({
      status: ["todo"],
    })
    expect(searchFromVisibility(state.columnVisibility)).toEqual({
      hide: ["notes"],
    })
    expect(searchFromSorting([])).toEqual({ sort: undefined, desc: false })
    expect(searchFromFilters([])).toEqual({ status: [] })
  })
})
