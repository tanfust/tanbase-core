import { taskStatuses } from "./contracts"
import type { TaskStatus, TaskView } from "./contracts"

const day = 24 * 60 * 60 * 1000
const week = 7 * day

/** How many weeks the activity chart shows, ending with the current one. */
export const statsWeeks = 8

export interface WeekActivity {
  /** The week's Monday at 00:00 UTC. */
  start: number
  /** The Monday as a short label, such as "Sep 21". */
  label: string
  created: number
  completed: number
}

export interface StatusCount {
  status: TaskStatus
  count: number
}

// UTC, so the server's render and the browser's agree whatever the zone.
const weekLabel = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})

/** The Monday at 00:00 UTC of the week that holds `timestamp`. */
export function weekStart(timestamp: number): number {
  const midnight = Math.floor(timestamp / day) * day
  // 1 January 1970 was a Thursday: day 0 is Thursday, day 4 is Monday.
  const weekday = (Math.floor(midnight / day) + 3) % 7
  return midnight - weekday * day
}

/**
 * Tasks created and completed in each of the last `weeks` weeks, oldest
 * first. The app stores no completion date, so a done task counts as
 * completed in the week it was last updated.
 */
export function weeklyActivity(
  tasks: readonly TaskView[],
  now: number,
  weeks = statsWeeks
): WeekActivity[] {
  const current = weekStart(now)
  const rows = Array.from({ length: weeks }, (_, index) => {
    const start = current - (weeks - 1 - index) * week
    return { start, label: weekLabel.format(start), created: 0, completed: 0 }
  })
  const first = rows[0].start

  function rowFor(timestamp: number) {
    const start = weekStart(timestamp)
    if (start < first || start > current) return undefined
    return rows[(start - first) / week]
  }

  for (const task of tasks) {
    const created = rowFor(task.createdAt)
    if (created) created.created += 1
    if (task.status === "done") {
      const completed = rowFor(task.updatedAt)
      if (completed) completed.completed += 1
    }
  }
  return rows
}

/** How many tasks are in each status, in board order. */
export function statusCounts(tasks: readonly TaskView[]): StatusCount[] {
  return taskStatuses.map((status) => ({
    status,
    count: tasks.filter((task) => task.status === status).length,
  }))
}
