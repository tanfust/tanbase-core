import { useMemo, useState } from "react"
import type { CSSProperties } from "react"
import { barX, barY, colorLegend, defineChart, group } from "@tanstack/charts"
import { Chart } from "@tanstack/charts/react"
import { scaleBand } from "@tanstack/charts/scales/band"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { tooltip } from "@tanstack/charts/tooltip"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { taskStatusLabels } from "@/modules/tasks/contracts"
import type { TaskStatus, TaskView } from "@/modules/tasks/contracts"
import { statsWeeks, statusCounts, weeklyActivity } from "@/modules/tasks/stats"

// The theme's chart tokens from src/styles.css, in the order series appear.
const palette = {
  "--ts-chart-1": "var(--chart-2)",
  "--ts-chart-2": "var(--chart-4)",
} as CSSProperties

/** Whole-number ticks from zero, about four of them, for a count axis. */
export function countTicks(max: number): number[] {
  const step = Math.max(1, Math.ceil(max / 4))
  const top = Math.max(step, Math.ceil(max / step) * step)
  return Array.from({ length: top / step + 1 }, (_, index) => index * step)
}

function countAxis(max: number, label: string) {
  const ticks = countTicks(max)
  return {
    scale: scaleLinear().domain([0, ticks.at(-1) ?? 1]),
    grid: true,
    axis: { label, ticks: { values: ticks, format: String } },
  }
}

interface ActivityRow {
  week: string
  series: "Created" | "Completed"
  count: number
}

function activityChart(rows: ActivityRow[]) {
  const max = Math.max(0, ...rows.map((row) => row.count))
  return defineChart({
    marks: [
      barY(rows, {
        x: "week",
        y: "count",
        z: "series",
        layout: group({ padding: 0.1 }),
        radius: 4,
      }),
    ],
    scales: {
      x: { scale: () => scaleBand<string>().padding(0.2) },
      y: countAxis(max, "Tasks"),
    },
    color: { legend: colorLegend() },
    tooltip,
  })
}

interface StatusRow {
  status: TaskStatus
  label: string
  count: number
}

function statusChart(rows: StatusRow[]) {
  const max = Math.max(0, ...rows.map((row) => row.count))
  return defineChart({
    marks: [
      barX(rows, {
        x: "count",
        y: "label",
        // The axis names each status, so one color is enough.
        fill: "var(--chart-3)",
        radius: 4,
      }),
    ],
    scales: {
      x: countAxis(max, "Tasks"),
      y: { scale: () => scaleBand<string>().padding(0.25) },
    },
    tooltip,
  })
}

/**
 * The project's activity and status mix, drawn with TanStack Charts from the
 * board data already in the query cache. Each chart has a table of the same
 * numbers for screen readers.
 */
export default function ProjectStats({
  tasks,
  projectName,
}: {
  tasks: TaskView[]
  projectName: string
}) {
  // One reading of the clock per mount keeps the weeks stable while open.
  const [now] = useState(() => Date.now())
  const weeks = useMemo(() => weeklyActivity(tasks, now), [tasks, now])
  const statuses = useMemo(
    () =>
      statusCounts(tasks).map((row) => ({
        ...row,
        label: taskStatusLabels[row.status],
      })),
    [tasks]
  )
  const activity = useMemo(
    () =>
      activityChart(
        weeks.flatMap((row) => [
          { week: row.label, series: "Created" as const, count: row.created },
          {
            week: row.label,
            series: "Completed" as const,
            count: row.completed,
          },
        ])
      ),
    [weeks]
  )
  const status = useMemo(() => statusChart(statuses), [statuses])
  const created = weeks.reduce((sum, row) => sum + row.created, 0)
  const completed = weeks.reduce((sum, row) => sum + row.completed, 0)

  return (
    <div className="grid gap-4 lg:grid-cols-5" style={palette}>
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>
            <h2>Created and completed</h2>
          </CardTitle>
          <CardDescription>
            {created} created and {completed} completed in the last {statsWeeks}{" "}
            weeks. Weeks start on Monday, UTC; a task counts as completed in the
            week it was last updated while done.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Chart
            definition={activity}
            height={260}
            initialWidth={560}
            ariaLabel={`Tasks created and completed per week in ${projectName}, last ${statsWeeks} weeks`}
            ariaDescription="Grouped bars: created and completed counts for each week, oldest first."
          />
          <table className="sr-only">
            <caption>Tasks created and completed per week</caption>
            <thead>
              <tr>
                <th scope="col">Week of</th>
                <th scope="col">Created</th>
                <th scope="col">Completed</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((row) => (
                <tr key={row.start}>
                  <th scope="row">{row.label}</th>
                  <td>{row.created}</td>
                  <td>{row.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>
            <h2>By status</h2>
          </CardTitle>
          <CardDescription>
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"} on the board
            now.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Chart
            definition={status}
            height={200}
            initialWidth={360}
            ariaLabel={`Tasks by status in ${projectName}`}
            ariaDescription="One bar per status: Todo, Doing, and Done."
          />
          <table className="sr-only">
            <caption>Tasks by status</caption>
            <tbody>
              {statuses.map((row) => (
                <tr key={row.status}>
                  <th scope="row">{row.label}</th>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
