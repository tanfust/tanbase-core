import { describe, expect, it } from "vitest"

import type { TaskView } from "./contracts"
import { statusCounts, weekStart, weeklyActivity } from "./stats"

const utc = (iso: string) => new Date(`${iso}Z`).getTime()

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
    createdAt: utc("2026-09-21T09:00:00"),
    updatedAt: utc("2026-09-21T09:00:00"),
    ...overrides,
  }
}

describe("weekStart", () => {
  it("returns the Monday at midnight UTC", () => {
    // 27 September 2026 is a Sunday; its week began on Monday the 21st.
    expect(weekStart(utc("2026-09-27T23:59:59"))).toBe(
      utc("2026-09-21T00:00:00")
    )
    expect(weekStart(utc("2026-09-21T00:00:00"))).toBe(
      utc("2026-09-21T00:00:00")
    )
    expect(weekStart(utc("2026-09-20T23:59:59"))).toBe(
      utc("2026-09-14T00:00:00")
    )
  })
})

describe("weeklyActivity", () => {
  const now = utc("2026-09-27T12:00:00")

  it("lists the last eight weeks, oldest first, with UTC labels", () => {
    const weeks = weeklyActivity([], now)
    expect(weeks).toHaveLength(8)
    expect(weeks.map((row) => row.label)).toEqual([
      "Aug 3",
      "Aug 10",
      "Aug 17",
      "Aug 24",
      "Aug 31",
      "Sep 7",
      "Sep 14",
      "Sep 21",
    ])
    expect(weeks.every((row) => row.created === 0 && row.completed === 0)).toBe(
      true
    )
  })

  it("counts creations, and completions by a done task's last update", () => {
    const weeks = weeklyActivity(
      [
        task({ createdAt: utc("2026-09-14T08:00:00") }),
        task({
          status: "done",
          createdAt: utc("2026-09-15T08:00:00"),
          updatedAt: utc("2026-09-22T08:00:00"),
        }),
        task({
          status: "doing",
          createdAt: utc("2026-09-22T08:00:00"),
          updatedAt: utc("2026-09-23T08:00:00"),
        }),
        // Older than the window: neither counts.
        task({
          status: "done",
          createdAt: utc("2026-06-01T08:00:00"),
          updatedAt: utc("2026-06-02T08:00:00"),
        }),
      ],
      now
    )
    const byLabel = Object.fromEntries(
      weeks.map((row) => [row.label, [row.created, row.completed]])
    )
    expect(byLabel["Sep 14"]).toEqual([2, 0])
    expect(byLabel["Sep 21"]).toEqual([1, 1])
    expect(weeks.reduce((sum, row) => sum + row.created, 0)).toBe(3)
  })
})

describe("statusCounts", () => {
  it("counts every status in board order, including empty ones", () => {
    expect(
      statusCounts([
        task({ status: "done" }),
        task({ status: "todo" }),
        task({ status: "done" }),
      ])
    ).toEqual([
      { status: "todo", count: 1 },
      { status: "doing", count: 0 },
      { status: "done", count: 2 },
    ])
  })
})
