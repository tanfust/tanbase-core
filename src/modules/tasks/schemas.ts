import { z } from "zod"

import "@/lib/zod-config"

import { taskStatuses } from "./contracts"

const projectName = z
  .string()
  .trim()
  .min(1, "Enter a project name.")
  .max(80, "Use at most 80 characters for the project name.")
const taskTitle = z
  .string()
  .trim()
  .min(1, "Enter a task title.")
  .max(200, "Use at most 200 characters for the title.")
const taskNotes = z
  .string()
  .trim()
  .max(10_000, "Use at most 10,000 characters for the notes.")
  .nullable()
const dueAt = z
  .number()
  .int()
  .nonnegative("Choose a valid due date.")
  .nullable()

export const boardInputSchema = z.object({
  projectId: z.string().min(1).optional(),
})

export const createProjectInputSchema = z.object({ name: projectName })

export const renameProjectInputSchema = z.object({
  projectId: z.string().min(1),
  name: projectName,
})

export const deleteProjectInputSchema = z.object({
  projectId: z.string().min(1),
})

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

export const createTaskInputSchema = taskValuesSchema.extend({
  projectId: z.string().min(1),
  // MCP clients and other callers may leave these out.
  notes: taskNotes.default(null),
  status: taskStatus.default("todo"),
  dueAt: dueAt.default(null),
})

export const updateTaskInputSchema = taskValuesSchema.partial().extend({
  taskId: z.string().min(1),
})

export const deleteTaskInputSchema = z.object({ taskId: z.string().min(1) })

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
export const taskFormSchema = z
  .object({
    title: z.string(),
    notes: z.string(),
    status: z.enum(taskStatuses),
    dueAt: z.string(),
  })
  .transform((values) => ({
    title: values.title,
    notes: values.notes.trim() || null,
    status: values.status,
    dueAt: dueAtFromDate(values.dueAt),
  }))
  .pipe(taskValuesSchema)

export type TaskFormValues = z.input<typeof taskFormSchema>
export type TaskValues = z.output<typeof taskFormSchema>
