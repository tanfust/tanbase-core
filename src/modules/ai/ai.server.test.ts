import { env } from "cloudflare:workers"
import { introspectWorkflowInstance } from "cloudflare:test"
import { describe, expect, it } from "vitest"

import {
  createProject,
  createTask,
  listTasksByProject,
} from "@/modules/tasks/repository.server"

import {
  getAiStatus,
  getTaskBreakdown,
  startTaskBreakdown,
} from "./breakdown.server"
import type { AiConfig } from "./config.server"
import { usageDay } from "./config.server"
import { breakdownFailureMessage } from "./contracts"
import type { BreakdownParams } from "./contracts"
import { getAiUse, refundAiUse, reserveAiUse } from "./repository.server"

const config: AiConfig = {
  ai: {} as Ai,
  model: "@cf/test/model",
  gatewayId: "test",
  dailyLimit: 2,
}
const allow = { limit: () => Promise.resolve({ success: true }) } as RateLimit
const block = { limit: () => Promise.resolve({ success: false }) } as RateLimit

function recordingWorkflow(fail = false) {
  const created: WorkflowInstanceCreateOptions<BreakdownParams>[] = []
  const workflow = {
    create: (options: WorkflowInstanceCreateOptions<BreakdownParams>) => {
      if (fail) return Promise.reject(new Error("unavailable"))
      created.push(options)
      return Promise.resolve({ id: options.id })
    },
  } as unknown as Workflow<BreakdownParams>
  return { created, workflow }
}

async function ownedTask(userId = `user${crypto.randomUUID().slice(0, 8)}`) {
  const project = await createProject(userId, { name: "Launch" }, env.DB)
  const task = await createTask(
    userId,
    { projectId: project.id, title: "Launch the site", notes: "Static" },
    env.DB
  )
  return { userId, project, task }
}

describe("AI quota", () => {
  it("reserves up to the daily limit and refunds one unit at a time", async () => {
    const userId = `quota-${crypto.randomUUID()}`
    const day = "2030-01-01"

    await expect(reserveAiUse(userId, day, 2, env.DB)).resolves.toBe(1)
    await expect(reserveAiUse(userId, day, 2, env.DB)).resolves.toBe(2)
    await expect(reserveAiUse(userId, day, 2, env.DB)).resolves.toBeNull()
    await expect(reserveAiUse(userId, "2030-01-02", 2, env.DB)).resolves.toBe(1)

    await refundAiUse(userId, day, env.DB)
    await expect(getAiUse(userId, day, env.DB)).resolves.toBe(1)
    await expect(reserveAiUse(userId, day, 2, env.DB)).resolves.toBe(2)
    await expect(reserveAiUse(userId, day, 0, env.DB)).resolves.toBeNull()
  })

  it("reports usage only where AI is configured", async () => {
    const { userId } = await ownedTask()
    const { workflow } = recordingWorkflow()

    await expect(
      getAiStatus(userId, { config: null, workflow })
    ).resolves.toEqual({ enabled: false, dailyLimit: 0, used: 0 })
    await expect(
      getAiStatus(userId, { config, workflow, database: env.DB })
    ).resolves.toEqual({ enabled: true, dailyLimit: 2, used: 0 })
  })
})

describe("starting a breakdown", () => {
  it("reserves quota and starts an owner-prefixed workflow run", async () => {
    const { userId, task } = await ownedTask()
    const { created, workflow } = recordingWorkflow()
    const now = Date.UTC(2031, 5, 1, 12)

    const { instanceId } = await startTaskBreakdown(userId, task.id, {
      config,
      limiter: allow,
      workflow,
      now,
      database: env.DB,
    })

    expect(instanceId.startsWith(`${userId}-`)).toBe(true)
    expect(created).toEqual([
      {
        id: instanceId,
        params: { taskId: task.id, userId, day: "2031-06-01" },
      },
    ])
    await expect(getAiUse(userId, "2031-06-01", env.DB)).resolves.toBe(1)
  })

  it("rejects unavailable AI, other users, subtasks, and parents", async () => {
    const { userId, project, task } = await ownedTask()
    const { workflow } = recordingWorkflow()
    const options = { config, limiter: allow, workflow, database: env.DB }
    const subtask = await createTask(
      userId,
      { projectId: project.id, parentId: task.id, title: "Child" },
      env.DB
    )

    await expect(
      startTaskBreakdown(userId, task.id, { ...options, config: null })
    ).rejects.toThrow("not available")
    await expect(
      startTaskBreakdown("someone-else", task.id, options)
    ).rejects.toThrow("Task not found")
    await expect(
      startTaskBreakdown(userId, subtask.id, options)
    ).rejects.toThrow("cannot be broken down further")
    await expect(startTaskBreakdown(userId, task.id, options)).rejects.toThrow(
      "already has subtasks"
    )
  })

  it("enforces the burst limit and the daily quota with clear messages", async () => {
    const { userId, task } = await ownedTask()
    const { workflow } = recordingWorkflow()
    const now = Date.UTC(2031, 6, 1)
    const options = { config, workflow, now, database: env.DB }

    await expect(
      startTaskBreakdown(userId, task.id, { ...options, limiter: block })
    ).rejects.toThrow("Too many AI requests")

    await startTaskBreakdown(userId, task.id, { ...options, limiter: allow })
    await startTaskBreakdown(userId, task.id, { ...options, limiter: allow })
    await expect(
      startTaskBreakdown(userId, task.id, { ...options, limiter: allow })
    ).rejects.toThrow(
      "You have used all 2 AI breakdowns for today. The quota resets at midnight UTC."
    )
  })

  it("refunds the reservation when the run cannot be created", async () => {
    const { userId, task } = await ownedTask()
    const { workflow } = recordingWorkflow(true)
    const now = Date.UTC(2031, 7, 1)

    await expect(
      startTaskBreakdown(userId, task.id, {
        config,
        limiter: allow,
        workflow,
        now,
        database: env.DB,
      })
    ).rejects.toThrow("could not start")
    await expect(getAiUse(userId, usageDay(now), env.DB)).resolves.toBe(0)
  })

  it("never reveals another user's run", async () => {
    await expect(
      getTaskBreakdown("user-a", "user-b-123", { workflow: env.BREAKDOWN })
    ).rejects.toThrow("Breakdown not found")
  })
})

describe("TaskBreakdownWorkflow", () => {
  it("inserts validated subtasks under the task and reports the count", async () => {
    const { userId, project, task } = await ownedTask()
    const id = `${userId}-${crypto.randomUUID()}`
    const subtasks = ["Write copy", "Pick a domain", "Add analytics"].map(
      (title) => ({ id: crypto.randomUUID(), title })
    )
    const instance = await introspectWorkflowInstance(env.BREAKDOWN, id)
    try {
      await instance.modify(async (m) => {
        await m.mockStepResult({ name: "generate subtasks" }, subtasks)
      })
      await env.BREAKDOWN.create({
        id,
        params: { taskId: task.id, userId, day: "2031-01-01" },
      })

      await instance.waitForStatus("complete")
      await expect(
        getTaskBreakdown(userId, id, { workflow: env.BREAKDOWN })
      ).resolves.toEqual({ state: "done", created: 3 })

      const children = (
        await listTasksByProject(userId, project.id, env.DB)
      ).filter((row) => row.parentId === task.id)
      expect(children.map((row) => row.title)).toEqual([
        "Write copy",
        "Pick a domain",
        "Add analytics",
      ])
      expect(children.every((row) => row.status === "todo")).toBe(true)
    } finally {
      await instance.dispose()
    }
  })

  it("retries generation, refunds the quota, and fails with a clear message", async () => {
    const { userId, task } = await ownedTask()
    const day = "2031-02-01"
    await reserveAiUse(userId, day, 5, env.DB)
    const id = `${userId}-${crypto.randomUUID()}`
    const instance = await introspectWorkflowInstance(env.BREAKDOWN, id)
    try {
      await instance.modify(async (m) => {
        await m.disableRetryDelays()
        await m.mockStepError(
          { name: "generate subtasks" },
          new Error("The model returned unusable subtasks: not JSON")
        )
      })
      await env.BREAKDOWN.create({
        id,
        params: { taskId: task.id, userId, day },
      })

      await instance.waitForStatus("errored")
      expect((await instance.getError()).message).toBe(breakdownFailureMessage)
      await expect(
        getTaskBreakdown(userId, id, { workflow: env.BREAKDOWN })
      ).resolves.toEqual({ state: "failed", message: breakdownFailureMessage })
      await expect(getAiUse(userId, day, env.DB)).resolves.toBe(0)
    } finally {
      await instance.dispose()
    }
  })
})
