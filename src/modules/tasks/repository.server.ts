import { and, asc, eq, isNotNull, lte, sql } from "drizzle-orm"

import { getDb } from "@/db"
import { projects, tasks } from "@/db/schema"
import type { Project, Task, TaskStatus } from "@/db/schema"

export interface CreateProjectInput {
  name: string
}

export interface CreateTaskInput {
  projectId: string
  parentId?: string | null
  title: string
  notes?: string | null
  status?: TaskStatus
  position?: number
  dueAt?: number | null
}

export interface UpdateTaskInput {
  title?: string
  notes?: string | null
  status?: TaskStatus
  dueAt?: number | null
}

export async function createProject(
  userId: string,
  input: CreateProjectInput,
  database?: D1Database
): Promise<Project> {
  const db = getDb(database)
  const project: Project = {
    id: crypto.randomUUID(),
    userId,
    name: input.name,
    createdAt: Date.now(),
  }

  await db.insert(projects).values(project)

  return project
}

export async function ensureDefaultProject(
  userId: string,
  database?: D1Database
): Promise<Project> {
  const db = getDb(database)
  const project: Project = {
    id: `default:${userId}`,
    userId,
    name: "My Project",
    createdAt: Date.now(),
  }

  await db.insert(projects).values(project).onConflictDoNothing()

  const savedProject = await getProject(userId, project.id, database)
  if (!savedProject) {
    throw new Error("Default project could not be created")
  }

  return savedProject
}

export async function getProject(
  userId: string,
  projectId: string,
  database?: D1Database
): Promise<Project | null> {
  const db = getDb(database)
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  })

  return project ?? null
}

export async function listProjects(
  userId: string,
  database?: D1Database
): Promise<Project[]> {
  const db = getDb(database)

  return db.query.projects.findMany({
    where: eq(projects.userId, userId),
    orderBy: [asc(projects.createdAt), asc(projects.id)],
  })
}

export async function renameProject(
  userId: string,
  projectId: string,
  name: string,
  database?: D1Database
): Promise<Project | null> {
  const db = getDb(database)
  const project = (
    await db
      .update(projects)
      .set({ name })
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning()
  ).at(0)

  return project ?? null
}

export async function deleteProject(
  userId: string,
  projectId: string,
  database?: D1Database
): Promise<boolean> {
  const db = getDb(database)
  const deleted = await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning({ id: projects.id })

  return deleted.length > 0
}

export async function createTask(
  userId: string,
  input: CreateTaskInput,
  database?: D1Database
): Promise<Task> {
  const db = getDb(database)
  const now = Date.now()
  const task: Task = {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    userId,
    parentId: input.parentId ?? null,
    title: input.title,
    notes: input.notes ?? null,
    status: input.status ?? "todo",
    position: input.position ?? 0,
    dueAt: input.dueAt ?? null,
    reminderSentAt: null,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(tasks).values(task)

  return task
}

export async function getTask(
  userId: string,
  taskId: string,
  database?: D1Database
): Promise<Task | null> {
  const db = getDb(database)
  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.userId, userId)),
  })

  return task ?? null
}

export async function listTasksByProject(
  userId: string,
  projectId: string,
  database?: D1Database
): Promise<Task[]> {
  const db = getDb(database)

  return db.query.tasks.findMany({
    where: and(eq(tasks.userId, userId), eq(tasks.projectId, projectId)),
    orderBy: [asc(tasks.status), asc(tasks.position), asc(tasks.id)],
  })
}

export interface TaskFilters {
  projectId?: string
  status?: TaskStatus
  /** Only tasks with a due date at or before this time. */
  dueBefore?: number
  limit: number
}

/** One owner's tasks across projects, newest due dates last. */
export async function listTasksForUser(
  userId: string,
  filters: TaskFilters,
  database?: D1Database
): Promise<(Task & { projectName: string })[]> {
  const db = getDb(database)
  const rows = await db
    .select({ task: tasks, projectName: projects.name })
    .from(tasks)
    .innerJoin(
      projects,
      and(eq(projects.id, tasks.projectId), eq(projects.userId, tasks.userId))
    )
    .where(
      and(
        eq(tasks.userId, userId),
        filters.projectId ? eq(tasks.projectId, filters.projectId) : undefined,
        filters.status ? eq(tasks.status, filters.status) : undefined,
        filters.dueBefore === undefined
          ? undefined
          : and(isNotNull(tasks.dueAt), lte(tasks.dueAt, filters.dueBefore))
      )
    )
    .orderBy(asc(tasks.status), asc(tasks.dueAt), asc(tasks.position))
    .limit(filters.limit)

  return rows.map(({ task, projectName }) => ({ ...task, projectName }))
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: UpdateTaskInput,
  database?: D1Database
): Promise<Task | null> {
  const db = getDb(database)
  const task = (
    await db
      .update(tasks)
      .set({
        ...input,
        // A new due date deserves a new reminder; saving the same date does not.
        ...(input.dueAt !== undefined && {
          reminderSentAt: sql`case when ${tasks.dueAt} is ${input.dueAt} then ${tasks.reminderSentAt} else null end`,
        }),
        updatedAt: Date.now(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning()
  ).at(0)

  return task ?? null
}

export async function deleteTask(
  userId: string,
  taskId: string,
  database?: D1Database
): Promise<boolean> {
  const db = getDb(database)
  const deleted = await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning({ id: tasks.id })

  return deleted.length > 0
}
