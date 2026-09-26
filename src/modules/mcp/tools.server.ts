import { publishBoardEvent } from "@/modules/realtime/rooms.server"
import type { TaskStatus, TaskView } from "@/modules/tasks/contracts"
import {
  createTask,
  ensureDefaultProject,
  getProject,
  listProjects,
  listTasksForUser,
  updateTask,
} from "@/modules/tasks/repository.server"
import type { Task } from "@/db/schema"

/** A task as MCP tools return it: dates as calendar days, project named. */
export interface McpTask {
  id: string
  title: string
  notes: string | null
  status: TaskStatus
  parentId: string | null
  dueDate: string | null
  project: { id: string; name: string }
}

export class McpToolError extends Error {}

/**
 * Due dates are calendar dates. The board stores noon in the browser's time
 * zone; tools use noon UTC, whose UTC date is the same day everywhere the
 * board shows it.
 */
export function dueAtFromDate(date: string): number {
  const [year, month, day] = date.split("-").map(Number)
  const dueAt = Date.UTC(year, month - 1, day, 12)
  if (new Date(dueAt).toISOString().slice(0, 10) !== date) {
    throw new McpToolError(`${date} is not a valid date.`)
  }
  return dueAt
}

function dueDate(dueAt: number | null): string | null {
  return dueAt === null ? null : new Date(dueAt).toISOString().slice(0, 10)
}

function toMcpTask(task: Task, projectName: string): McpTask {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    status: task.status,
    parentId: task.parentId,
    dueDate: dueDate(task.dueAt),
    project: { id: task.projectId, name: projectName },
  }
}

function toTaskView(task: Task): TaskView {
  return {
    id: task.id,
    projectId: task.projectId,
    parentId: task.parentId,
    title: task.title,
    notes: task.notes,
    status: task.status,
    position: task.position,
    dueAt: task.dueAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}

export async function listTasks(
  userId: string,
  input: {
    projectId?: string
    status?: TaskStatus
    dueBefore?: string
    limit?: number
  },
  database?: D1Database
): Promise<{ tasks: McpTask[] }> {
  // Inclusive of the whole calendar day given.
  const dueBefore =
    input.dueBefore === undefined
      ? undefined
      : dueAtFromDate(input.dueBefore) + 12 * 60 * 60 * 1000 - 1
  const rows = await listTasksForUser(
    userId,
    {
      projectId: input.projectId,
      status: input.status,
      dueBefore,
      limit: input.limit ?? 50,
    },
    database
  )
  return { tasks: rows.map((row) => toMcpTask(row, row.projectName)) }
}

export async function createTaskForUser(
  userId: string,
  input: {
    title: string
    notes?: string
    projectId?: string
    status?: TaskStatus
    dueDate?: string
  },
  database?: D1Database
): Promise<McpTask> {
  const project = input.projectId
    ? await getProject(userId, input.projectId, database)
    : ((await listProjects(userId, database)).at(0) ??
      (await ensureDefaultProject(userId, database)))
  if (!project) throw new McpToolError("Project not found.")

  const task = await createTask(
    userId,
    {
      projectId: project.id,
      title: input.title,
      notes: input.notes ?? null,
      status: input.status ?? "todo",
      dueAt: input.dueDate ? dueAtFromDate(input.dueDate) : null,
    },
    database
  )
  publishBoardEvent(userId, project.id, {
    type: "task.upserted",
    task: toTaskView(task),
  })
  return toMcpTask(task, project.name)
}

export async function completeTask(
  userId: string,
  taskId: string,
  database?: D1Database
): Promise<McpTask> {
  const task = await updateTask(userId, taskId, { status: "done" }, database)
  if (!task) throw new McpToolError("Task not found.")
  const project = await getProject(userId, task.projectId, database)
  publishBoardEvent(userId, task.projectId, {
    type: "task.upserted",
    task: toTaskView(task),
  })
  return toMcpTask(task, project?.name ?? "")
}
