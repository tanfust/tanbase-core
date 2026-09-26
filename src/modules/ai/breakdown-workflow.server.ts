import { WorkflowEntrypoint } from "cloudflare:workers"
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers"
import { NonRetryableError } from "cloudflare:workflows"

import { broadcastBoardEvents } from "@/modules/realtime/rooms.server"
import type { TaskView } from "@/modules/tasks/contracts"
import { getTask } from "@/modules/tasks/repository.server"
import { log } from "@/platform/log"

import { readAiConfig } from "./config.server"
import { breakdownFailureMessage } from "./contracts"
import type { BreakdownOutput, BreakdownParams } from "./contracts"
import { generateSubtasks } from "./model.server"
import { insertSubtasks, refundAiUse } from "./repository.server"

// Invalid model output fails the attempt; two retries give the model three
// chances before the run fails cleanly.
const generationRetries = {
  limit: 2,
  delay: "2 seconds",
  backoff: "constant",
} as const

/**
 * Breaks one task into subtasks: load the task, generate and validate
 * subtasks, insert them in one statement, then broadcast them to the board.
 * Every step retries on its own; a run that ends without subtasks refunds
 * the quota it reserved.
 */
export class TaskBreakdownWorkflow extends WorkflowEntrypoint<
  Env,
  BreakdownParams
> {
  async run(
    event: WorkflowEvent<BreakdownParams>,
    step: WorkflowStep
  ): Promise<BreakdownOutput> {
    const { day, taskId, userId } = event.payload

    let subtasks: { id: string; title: string }[]
    let parent: { id: string; projectId: string }
    try {
      const task = await step.do("load task", async () => {
        const row = await getTask(userId, taskId)
        if (!row) throw new NonRetryableError("The task no longer exists.")
        return {
          id: row.id,
          projectId: row.projectId,
          title: row.title,
          notes: row.notes,
        }
      })
      parent = task

      subtasks = await step.do(
        "generate subtasks",
        { retries: generationRetries, timeout: "1 minute" },
        async () => {
          const config = readAiConfig()
          if (!config) throw new NonRetryableError("AI is not configured.")
          const titles = await generateSubtasks(task, config)
          // IDs are fixed here, so a retried insert cannot duplicate rows.
          return titles.map((title) => ({ id: crypto.randomUUID(), title }))
        }
      )
    } catch (error) {
      await step.do("refund quota", async () => {
        await refundAiUse(userId, day)
      })
      log.warn("Task breakdown failed", {
        event: "ai.breakdown_failed",
        instanceId: event.instanceId,
        error: error instanceof Error ? error.message : "Unknown error",
      })
      // Thrown outside a step, so the run ends at once with this message.
      throw new Error(breakdownFailureMessage)
    }

    const created = await step.do("insert subtasks", async () => {
      const rows = await insertSubtasks(userId, parent, subtasks)
      return rows.map((row): TaskView => ({
        id: row.id,
        projectId: row.projectId,
        parentId: row.parentId,
        title: row.title,
        notes: row.notes,
        status: row.status,
        position: row.position,
        dueAt: row.dueAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }))
    })

    await step.do("broadcast to the board", async () => {
      // Best effort: clients also refetch when they see the run finish.
      try {
        await broadcastBoardEvents(
          userId,
          parent.projectId,
          created.map((task) => ({ type: "task.upserted", task }))
        )
      } catch (error) {
        log.warn("Board event was not delivered", {
          event: "realtime.broadcast_failed",
          type: "task.upserted",
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    })

    log.info("Task breakdown finished", {
      event: "ai.breakdown_finished",
      instanceId: event.instanceId,
      created: created.length,
    })
    return { created: created.length }
  }
}
