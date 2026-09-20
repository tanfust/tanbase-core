import { z } from "zod"

import { taskStatuses } from "./contracts"

const projectName = z.string().trim().min(1).max(80)
const taskTitle = z.string().trim().min(1).max(200)
const taskNotes = z.string().trim().max(10_000).nullable()
const dueAt = z.number().int().nonnegative().nullable()

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

export const createTaskInputSchema = z.object({
  projectId: z.string().min(1),
  title: taskTitle,
  notes: taskNotes.default(null),
  status: z.enum(taskStatuses).default("todo"),
  dueAt: dueAt.default(null),
})

export const updateTaskInputSchema = z.object({
  taskId: z.string().min(1),
  title: taskTitle.optional(),
  notes: taskNotes.optional(),
  status: z.enum(taskStatuses).optional(),
  dueAt: dueAt.optional(),
})

export const deleteTaskInputSchema = z.object({ taskId: z.string().min(1) })
