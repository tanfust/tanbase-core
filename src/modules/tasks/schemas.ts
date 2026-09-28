import { z } from "zod/mini"

import "@/lib/zod-config"

import { taskStatuses } from "./contracts"

// The board's forms load these schemas, so they use `zod/mini`: the browser
// then carries only the checks below, not all of Zod.

const id = z.string().check(z.minLength(1))

const projectName = z
  .string()
  .check(
    z.trim(),
    z.minLength(1, "Enter a project name."),
    z.maxLength(80, "Use at most 80 characters for the project name.")
  )
const taskTitle = z
  .string()
  .check(
    z.trim(),
    z.minLength(1, "Enter a task title."),
    z.maxLength(200, "Use at most 200 characters for the title.")
  )
const taskNotes = z.nullable(
  z
    .string()
    .check(
      z.trim(),
      z.maxLength(10_000, "Use at most 10,000 characters for the notes.")
    )
)
const dueAt = z.nullable(
  z.int().check(z.nonnegative("Choose a valid due date."))
)

export const boardInputSchema = z.object({ projectId: z.optional(id) })

export const createProjectInputSchema = z.object({ name: projectName })

export const renameProjectInputSchema = z.object({
  projectId: id,
  name: projectName,
})

export const deleteProjectInputSchema = z.object({ projectId: id })

const taskStatus = z.enum(taskStatuses)

/**
 * A task's editable values. `createTask` and `updateTask` extend it, so the
 * task dialog and the server functions apply the same rules.
 */
export const taskValuesSchema = z.object({
  title: taskTitle,
  notes: taskNotes,
  status: taskStatus,
  dueAt,
})

export const createTaskInputSchema = z.extend(taskValuesSchema, {
  projectId: id,
  // MCP clients and other callers may leave these out.
  notes: z._default(taskNotes, null),
  status: z._default(taskStatus, "todo"),
  dueAt: z._default(dueAt, null),
})

export const updateTaskInputSchema = z.extend(z.partial(taskValuesSchema), {
  taskId: id,
})

export const deleteTaskInputSchema = z.object({ taskId: id })

/** Noon on a calendar day in the browser's time zone, or null for none. */
export function dueAtFromDate(day: string): number | null {
  return day ? new Date(`${day}T12:00:00`).getTime() : null
}

/** The calendar day of a due timestamp in the browser's time zone. */
export function dateFromDueAt(timestamp: number | null): string {
  if (!timestamp) return ""
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * The task dialog's fields, as the inputs hold them. They convert to task
 * values and then pass through `taskValuesSchema`, the same rules the server
 * functions apply, so a field error in the dialog names the same rule.
 */
export const taskFormSchema = z.pipe(
  z.pipe(
    z.object({
      title: z.string(),
      notes: z.string(),
      status: z.enum(taskStatuses),
      dueAt: z.string(),
    }),
    z.transform((values) => ({
      title: values.title,
      notes: values.notes.trim() || null,
      status: values.status,
      dueAt: dueAtFromDate(values.dueAt),
    }))
  ),
  taskValuesSchema
)

export type TaskFormValues = z.input<typeof taskFormSchema>
export type TaskValues = z.output<typeof taskFormSchema>
