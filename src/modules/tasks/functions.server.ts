import { getRequestHeaders } from "@tanstack/react-start/server"

import type { Project, Task } from "@/db/schema"
import { getSessionFromHeaders } from "@/modules/auth/session.server"
import {
  listAttachmentKeysForProject,
  listAttachmentKeysForTaskTree,
} from "@/modules/files/repository.server"
import {
  getFilesBucket,
  removeStoredObjects,
} from "@/modules/files/storage.server"
import { publishBoardEvent } from "@/modules/realtime/rooms.server"

import type { BoardSnapshot, ProjectView, TaskView } from "./contracts"
import {
  createProject as createProjectRecord,
  createTask as createTaskRecord,
  deleteProject as deleteProjectRecord,
  deleteTask as deleteTaskRecord,
  getProject,
  getTask,
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

// Views copy fields explicitly, so owner IDs and internal columns such as
// reminder_sent_at never reach the client or board events.
function toProjectView(project: Project): ProjectView {
  return { id: project.id, name: project.name, createdAt: project.createdAt }
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
  const view = toProjectView(project)
  publishBoardEvent(userId, project.id, {
    type: "project.renamed",
    project: view,
  })
  return view
}

export async function deleteProjectImpl(
  input: z.infer<typeof deleteProjectInputSchema>
) {
  const userId = await requireUserId()
  // Collect object keys before the cascading delete removes their rows.
  const keys = await listAttachmentKeysForProject(userId, input.projectId)
  if (!(await deleteProjectRecord(userId, input.projectId))) {
    throw new Error("Project not found")
  }
  await removeStoredObjects(getFilesBucket(), keys)
  publishBoardEvent(userId, input.projectId, {
    type: "project.deleted",
    projectId: input.projectId,
  })
  return { id: input.projectId }
}

export async function createTaskImpl(
  input: z.infer<typeof createTaskInputSchema>
) {
  const userId = await requireUserId()
  const task = toTaskView(await createTaskRecord(userId, input))
  publishBoardEvent(userId, task.projectId, { type: "task.upserted", task })
  return task
}

export async function updateTaskImpl(
  input: z.infer<typeof updateTaskInputSchema>
) {
  const userId = await requireUserId()
  const { taskId, ...changes } = input
  const updated = await updateTaskRecord(userId, taskId, changes)
  if (!updated) throw new Error("Task not found")
  const task = toTaskView(updated)
  publishBoardEvent(userId, task.projectId, { type: "task.upserted", task })
  return task
}

export async function deleteTaskImpl(
  input: z.infer<typeof deleteTaskInputSchema>
) {
  const userId = await requireUserId()
  const task = await getTask(userId, input.taskId)
  if (!task) throw new Error("Task not found")
  // Includes subtasks, which the task's cascading delete also removes.
  const keys = await listAttachmentKeysForTaskTree(userId, input.taskId)
  if (!(await deleteTaskRecord(userId, input.taskId))) {
    throw new Error("Task not found")
  }
  await removeStoredObjects(getFilesBucket(), keys)
  publishBoardEvent(userId, task.projectId, {
    type: "task.deleted",
    taskId: task.id,
    projectId: task.projectId,
  })
  return { id: input.taskId }
}
