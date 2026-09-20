import { getRequestHeaders } from "@tanstack/react-start/server"

import { getSessionFromHeaders } from "@/modules/auth/session.server"

import type { BoardSnapshot, ProjectView, TaskView } from "./contracts"
import {
  createProject as createProjectRecord,
  createTask as createTaskRecord,
  deleteProject as deleteProjectRecord,
  deleteTask as deleteTaskRecord,
  getProject,
  listProjects,
  listTasksByProject,
  renameProject as renameProjectRecord,
  updateTask as updateTaskRecord,
} from "./repository.server"
import type {
  createProjectInputSchema,
  createTaskInputSchema,
  deleteProjectInputSchema,
  deleteTaskInputSchema,
  renameProjectInputSchema,
  updateTaskInputSchema,
} from "./schemas"
import type { z } from "zod"

async function requireUserId() {
  const session = await getSessionFromHeaders(getRequestHeaders())
  if (!session) throw new Error("Unauthorized")
  return session.user.id
}

function toProjectView(project: {
  id: string
  name: string
  createdAt: number
}): ProjectView {
  return project
}

function toTaskView(task: {
  id: string
  projectId: string
  parentId: string | null
  title: string
  notes: string | null
  status: "todo" | "doing" | "done"
  position: number
  dueAt: number | null
  createdAt: number
  updatedAt: number
}): TaskView {
  return task
}

export async function getProjectsImpl(): Promise<ProjectView[]> {
  const userId = await requireUserId()
  return (await listProjects(userId)).map(toProjectView)
}

export async function getBoardImpl(input: {
  projectId?: string
}): Promise<BoardSnapshot> {
  const userId = await requireUserId()
  const projects = await listProjects(userId)
  const activeProject = input.projectId
    ? await getProject(userId, input.projectId)
    : (projects[0] ?? null)

  if (input.projectId && !activeProject) throw new Error("Project not found")

  return {
    projects: projects.map(toProjectView),
    activeProject: activeProject ? toProjectView(activeProject) : null,
    tasks: activeProject
      ? (await listTasksByProject(userId, activeProject.id)).map(toTaskView)
      : [],
  }
}

export async function createProjectImpl(
  input: z.infer<typeof createProjectInputSchema>
) {
  const userId = await requireUserId()
  return toProjectView(await createProjectRecord(userId, input))
}

export async function renameProjectImpl(
  input: z.infer<typeof renameProjectInputSchema>
) {
  const userId = await requireUserId()
  const project = await renameProjectRecord(userId, input.projectId, input.name)
  if (!project) throw new Error("Project not found")
  return toProjectView(project)
}

export async function deleteProjectImpl(
  input: z.infer<typeof deleteProjectInputSchema>
) {
  const userId = await requireUserId()
  if (!(await deleteProjectRecord(userId, input.projectId))) {
    throw new Error("Project not found")
  }
  return { id: input.projectId }
}

export async function createTaskImpl(
  input: z.infer<typeof createTaskInputSchema>
) {
  const userId = await requireUserId()
  return toTaskView(await createTaskRecord(userId, input))
}

export async function updateTaskImpl(
  input: z.infer<typeof updateTaskInputSchema>
) {
  const userId = await requireUserId()
  const { taskId, ...changes } = input
  const task = await updateTaskRecord(userId, taskId, changes)
  if (!task) throw new Error("Task not found")
  return toTaskView(task)
}

export async function deleteTaskImpl(
  input: z.infer<typeof deleteTaskInputSchema>
) {
  const userId = await requireUserId()
  if (!(await deleteTaskRecord(userId, input.taskId))) {
    throw new Error("Task not found")
  }
  return { id: input.taskId }
}
