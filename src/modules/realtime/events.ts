import type {
  BoardSnapshot,
  ProjectView,
  TaskView,
} from "@/modules/tasks/contracts"

// Messages a BoardRoom sends to every socket in one owner's project room.
export type BoardEvent =
  | { type: "task.upserted"; task: TaskView }
  | { type: "task.deleted"; taskId: string; projectId: string }
  | { type: "project.renamed"; project: ProjectView }
  | { type: "project.deleted"; projectId: string }

const eventTypes = new Set([
  "task.upserted",
  "task.deleted",
  "project.renamed",
  "project.deleted",
])

export function parseBoardEvent(data: unknown): BoardEvent | null {
  if (typeof data !== "string") return null
  try {
    const event: unknown = JSON.parse(data)
    return event &&
      typeof event === "object" &&
      "type" in event &&
      typeof event.type === "string" &&
      eventTypes.has(event.type)
      ? (event as BoardEvent)
      : null
  } catch {
    return null
  }
}

/** Removes a task and every subtask beneath it, as the database cascade does. */
function withoutTaskTree(tasks: TaskView[], rootId: string): TaskView[] {
  const removed = new Set([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const task of tasks) {
      if (
        task.parentId &&
        removed.has(task.parentId) &&
        !removed.has(task.id)
      ) {
        removed.add(task.id)
        grew = true
      }
    }
  }
  return tasks.filter((task) => !removed.has(task.id))
}

/**
 * Applies an event to a cached board. Events for other projects are ignored,
 * and an update never replaces a newer copy of a task, so a device's own echo
 * and out-of-order delivery are both harmless.
 */
export function applyBoardEvent(
  snapshot: BoardSnapshot | undefined,
  event: BoardEvent
): BoardSnapshot | undefined {
  const active = snapshot?.activeProject
  if (!snapshot || !active) return snapshot

  switch (event.type) {
    case "task.upserted": {
      const { task } = event
      if (task.projectId !== active.id) return snapshot
      const existing = snapshot.tasks.find((item) => item.id === task.id)
      if (existing && existing.updatedAt > task.updatedAt) return snapshot
      return {
        ...snapshot,
        tasks: existing
          ? snapshot.tasks.map((item) => (item.id === task.id ? task : item))
          : [...snapshot.tasks, task],
      }
    }
    case "task.deleted":
      if (event.projectId !== active.id) return snapshot
      return {
        ...snapshot,
        tasks: withoutTaskTree(snapshot.tasks, event.taskId),
      }
    case "project.renamed":
      return {
        ...snapshot,
        activeProject: active.id === event.project.id ? event.project : active,
        projects: snapshot.projects.map((project) =>
          project.id === event.project.id ? event.project : project
        ),
      }
    case "project.deleted":
      return snapshot
  }
}
