import { getTask } from "@/modules/tasks/repository.server"

import {
  getAiLimiter,
  getBreakdownWorkflow,
  readAiConfig,
  usageDay,
} from "./config.server"
import type { AiConfig } from "./config.server"
import { breakdownFailureMessage } from "./contracts"
import type {
  AiStatus,
  BreakdownOutput,
  BreakdownParams,
  BreakdownState,
} from "./contracts"
import {
  countSubtasks,
  getAiUse,
  refundAiUse,
  reserveAiUse,
} from "./repository.server"

interface BreakdownDependencies {
  config?: AiConfig | null
  limiter?: RateLimit | null
  workflow?: Workflow<BreakdownParams> | null
  now?: number
  database?: D1Database
}

// Instance IDs start with the owner's ID, so a status lookup can be scoped to
// its owner without storing anything.
function instanceOwner(userId: string) {
  return `${userId}-`
}

export async function getAiStatus(
  userId: string,
  {
    config = readAiConfig(),
    workflow = getBreakdownWorkflow(),
    now = Date.now(),
    database,
  }: BreakdownDependencies = {}
): Promise<AiStatus> {
  if (!config || !workflow) return { enabled: false, dailyLimit: 0, used: 0 }
  return {
    enabled: true,
    dailyLimit: config.dailyLimit,
    used: await getAiUse(userId, usageDay(now), database),
  }
}

/**
 * Checks the task, the burst limit, and the daily quota, then starts a
 * TaskBreakdownWorkflow run. Errors carry the message shown to the user.
 */
export async function startTaskBreakdown(
  userId: string,
  taskId: string,
  {
    config = readAiConfig(),
    limiter = getAiLimiter(),
    workflow = getBreakdownWorkflow(),
    now = Date.now(),
    database,
  }: BreakdownDependencies = {}
): Promise<{ instanceId: string }> {
  if (!config || !workflow) {
    throw new Error("AI breakdown is not available in this environment.")
  }

  const task = await getTask(userId, taskId, database)
  if (!task) throw new Error("Task not found")
  if (task.parentId) throw new Error("Subtasks cannot be broken down further.")
  if ((await countSubtasks(userId, taskId, database)) > 0) {
    throw new Error("This task already has subtasks.")
  }

  if (limiter && !(await limiter.limit({ key: userId })).success) {
    throw new Error("Too many AI requests. Wait a minute and try again.")
  }

  const day = usageDay(now)
  const used = await reserveAiUse(userId, day, config.dailyLimit, database)
  if (used === null) {
    throw new Error(
      `You have used all ${config.dailyLimit} AI breakdowns for today. The quota resets at midnight UTC.`
    )
  }

  try {
    const instance = await workflow.create({
      id: `${instanceOwner(userId)}${crypto.randomUUID()}`,
      params: { taskId, userId, day },
    })
    return { instanceId: instance.id }
  } catch {
    await refundAiUse(userId, day, database)
    throw new Error("The breakdown could not start. Try again.")
  }
}

const runningStatuses = new Set([
  "queued",
  "running",
  "waiting",
  "paused",
  "waitingForPause",
])

export async function getTaskBreakdown(
  userId: string,
  instanceId: string,
  { workflow = getBreakdownWorkflow() }: BreakdownDependencies = {}
): Promise<BreakdownState> {
  if (!workflow || !instanceId.startsWith(instanceOwner(userId))) {
    throw new Error("Breakdown not found")
  }

  const status = await (await workflow.get(instanceId)).status()
  if (runningStatuses.has(status.status)) return { state: "running" }
  if (status.status === "complete") {
    const output = status.output as BreakdownOutput | undefined
    return { state: "done", created: output?.created ?? 0 }
  }
  return { state: "failed", message: breakdownFailureMessage }
}
