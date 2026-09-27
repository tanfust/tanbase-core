import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { TaskView } from "@/modules/tasks/contracts"

import ProjectStats, { countTicks } from "./project-stats"

beforeAll(() => {
  // jsdom has no layout; the chart host observes its container's size.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

afterEach(() => cleanup())

const now = Date.now()
const day = 24 * 60 * 60 * 1000

function task(overrides: Partial<TaskView>): TaskView {
  return {
    id: crypto.randomUUID(),
    projectId: "project",
    parentId: null,
    title: "Task",
    notes: null,
    status: "todo",
    position: 0,
    dueAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe("countTicks", () => {
  it("uses whole numbers from zero", () => {
    expect(countTicks(0)).toEqual([0, 1])
    expect(countTicks(3)).toEqual([0, 1, 2, 3])
    expect(countTicks(9)).toEqual([0, 3, 6, 9])
    expect(countTicks(10)).toEqual([0, 3, 6, 9, 12])
  })
})

describe("ProjectStats", () => {
  it("draws both charts with names and gives their numbers as tables", () => {
    render(
      <ProjectStats
        projectName="Launch"
        tasks={[
          task({ status: "done" }),
          task({ status: "doing" }),
          task({ status: "todo", createdAt: now - 70 * day }),
        ]}
      />
    )

    expect(
      screen.getByRole("img", {
        name: "Tasks created and completed per week in Launch, last 8 weeks",
      })
    ).toBeTruthy()
    expect(
      screen.getByRole("img", { name: "Tasks by status in Launch" })
    ).toBeTruthy()

    // The task created ten weeks ago is outside the window.
    expect(
      screen.getByText(/2 created and 1 completed in the last 8 weeks/)
    ).toBeTruthy()
    expect(screen.getByText("3 tasks on the board now.")).toBeTruthy()

    const statusTable = screen.getByRole("table", { name: "Tasks by status" })
    const rows = within(statusTable)
      .getAllByRole("row")
      .map((row) => row.textContent)
    expect(rows).toEqual(["Todo1", "Doing1", "Done1"])

    const weekly = screen.getByRole("table", {
      name: "Tasks created and completed per week",
    })
    // A header row and eight weeks.
    expect(within(weekly).getAllByRole("row")).toHaveLength(9)
  })
})
