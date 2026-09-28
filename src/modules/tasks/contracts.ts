export const taskStatuses = ["todo", "doing", "done"] as const
export type TaskStatus = (typeof taskStatuses)[number]

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "Todo",
  doing: "Doing",
  done: "Done",
}

/**
 * The ID prefix of a task the board shows before the server has created it.
 * The server's own IDs are UUIDs, so they never start with it.
 */
export const optimisticTaskPrefix = "optimistic:"

export interface ProjectView {
  id: string
  name: string
  createdAt: number
}

export interface TaskView {
  id: string
  projectId: string
  parentId: string | null
  title: string
  notes: string | null
  status: TaskStatus
  position: number
  dueAt: number | null
  createdAt: number
  updatedAt: number
}

export interface BoardSnapshot {
  projects: ProjectView[]
  activeProject: ProjectView | null
  tasks: TaskView[]
}
