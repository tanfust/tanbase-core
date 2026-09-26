/** Shown to the user when a breakdown ends without subtasks. */
export const breakdownFailureMessage =
  "The AI could not break this task down. Your daily quota was not used; try again."

/** Parameters of one TaskBreakdownWorkflow instance. */
export interface BreakdownParams {
  taskId: string
  userId: string
  /** UTC day whose quota the run reserved, so a failure can refund it. */
  day: string
}

export interface BreakdownOutput {
  created: number
}

export interface AiStatus {
  enabled: boolean
  dailyLimit: number
  used: number
}

export type BreakdownState =
  | { state: "running" }
  | { state: "done"; created: number }
  | { state: "failed"; message: string }
