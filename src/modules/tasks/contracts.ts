export const taskStatuses = ["todo", "doing", "done"] as const
export type TaskStatus = (typeof taskStatuses)[number]

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "Todo",
  doing: "Doing",
  done: "Done",
}

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
