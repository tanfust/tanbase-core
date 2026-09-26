import { env } from "cloudflare:workers"
import {
  createExecutionContext,
  createMessageBatch,
  getQueueResult,
} from "cloudflare:test"
import { describe, expect, it } from "vitest"

import type { SendEmailInput } from "@/modules/email/types"
import {
  createProject,
  createTask,
  getTask,
} from "@/modules/tasks/repository.server"

import { enqueueDueReminders } from "./cron.server"
import { processReminderBatch } from "./queue.server"
import { formatDueDate, reminderWindowMs } from "./reminders"
import type { ReminderMessage } from "./reminders"

const hour = 60 * 60 * 1000
const appOrigin = "https://core.tanbase.dev"

async function createUser(verified = true) {
  const id = `user-${crypto.randomUUID()}`
  await env.DB.prepare(
    "INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, ?)"
  )
    .bind(id, "Amina", `${id}@example.com`, verified ? 1 : 0)
    .run()
  return id
}

async function dueTask(userId: string, dueAt: number | null, title = "Ship") {
  const project = await createProject(userId, { name: "Launch" }, env.DB)
  return createTask(userId, { projectId: project.id, title, dueAt }, env.DB)
}

async function markReminded(taskId: string) {
  await env.DB.prepare("UPDATE task SET reminder_sent_at = 1 WHERE id = ?")
    .bind(taskId)
    .run()
}

function fakeQueue() {
  const batches: MessageSendRequest<ReminderMessage>[][] = []
  const queue = {
    sendBatch: (messages: Iterable<MessageSendRequest<ReminderMessage>>) => {
      batches.push([...messages])
      return Promise.resolve()
    },
  } as unknown as Queue<ReminderMessage>
  return { batches, queue }
}

function recorder(failures = 0) {
  const sent: SendEmailInput[] = []
  let remainingFailures = failures
  const send = (input: SendEmailInput) => {
    if (remainingFailures > 0) {
      remainingFailures -= 1
      return Promise.reject(new Error("Email delivery failed"))
    }
    sent.push(input)
    return Promise.resolve()
  }
  return { send, sent }
}

function batchOf(messages: { id: string; body: unknown; attempts?: number }[]) {
  return createMessageBatch(
    "tanbase-core-email-local",
    messages.map(({ attempts = 1, ...message }) => ({
      ...message,
      attempts,
      timestamp: new Date(),
    }))
  )
}

// Each test uses its own far-future clock so tasks from other tests never
// fall inside its reminder window.
describe("reminder cron", () => {
  it("enqueues only open, unreminded tasks of verified users due within a day", async () => {
    const now = Date.UTC(2031, 0, 10, 9)
    const owner = await createUser()
    const unverified = await createUser(false)

    const soon = await dueTask(owner, now + 2 * hour)
    const lastHour = await dueTask(owner, now + reminderWindowMs)
    await dueTask(owner, now + reminderWindowMs + hour)
    await dueTask(owner, now - hour)
    await dueTask(owner, null)
    const reminded = await dueTask(owner, now + 3 * hour)
    await markReminded(reminded.id)
    const done = await dueTask(owner, now + 3 * hour)
    await env.DB.prepare("UPDATE task SET status = 'done' WHERE id = ?")
      .bind(done.id)
      .run()
    await dueTask(unverified, now + 2 * hour)

    const { batches, queue } = fakeQueue()
    await expect(
      enqueueDueReminders(now, { queue, database: env.DB })
    ).resolves.toBe(2)

    expect(batches.flat()).toEqual([
      { body: { taskId: soon.id, dueAt: now + 2 * hour }, contentType: "json" },
      {
        body: { taskId: lastHour.id, dueAt: now + reminderWindowMs },
        contentType: "json",
      },
    ])
  })

  it("splits large runs into queue batches of at most 100", async () => {
    const now = Date.UTC(2033, 0, 10, 9)
    const owner = await createUser()
    const project = await createProject(owner, { name: "Bulk" }, env.DB)
    await env.DB.batch(
      Array.from({ length: 101 }, (_, index) =>
        env.DB.prepare(
          "INSERT INTO task (id, project_id, user_id, title, status, position, due_at, created_at, updated_at) VALUES (?, ?, ?, 'Bulk', 'todo', 0, ?, 0, 0)"
        ).bind(crypto.randomUUID(), project.id, owner, now + hour + index)
      )
    )

    const { batches, queue } = fakeQueue()
    await enqueueDueReminders(now, { queue, database: env.DB })

    expect(batches.map((batch) => batch.length)).toEqual([100, 1])
  })

  it("does nothing without a queue", async () => {
    await expect(
      enqueueDueReminders(Date.now(), { queue: null })
    ).resolves.toBe(0)
  })
})

describe("reminder consumer", () => {
  it("sends one email for duplicate messages and records the reminder", async () => {
    const now = Date.UTC(2032, 0, 9, 13)
    const owner = await createUser()
    const task = await dueTask(owner, Date.UTC(2032, 0, 10, 12), "Review")
    const body = { taskId: task.id, dueAt: task.dueAt }
    const { send, sent } = recorder()
    const batch = batchOf([
      { id: "first", body },
      { id: "duplicate", body },
    ])

    await processReminderBatch(batch, {
      appOrigin,
      database: env.DB,
      now: () => now,
      send,
    })
    const result = await getQueueResult(batch, createExecutionContext())

    expect(sent).toEqual([
      {
        template: "taskReminder",
        to: `${owner}@example.com`,
        subject: "Reminder: Review is due Saturday, January 10",
        props: {
          dueAt: "on Saturday, January 10",
          name: "Amina",
          projectName: "Launch",
          taskTitle: "Review",
          taskUrl: `${appOrigin}/app?project=${task.projectId}`,
        },
      },
    ])
    expect(result.explicitAcks).toEqual(["first", "duplicate"])
    expect(result.retryMessages).toEqual([])
    expect((await getTask(owner, task.id, env.DB))?.reminderSentAt).toBe(now)

    // A redelivery after the fact is still a no-op.
    const later = batchOf([{ id: "redelivered", body }])
    await processReminderBatch(later, { appOrigin, database: env.DB, send })
    expect(sent).toHaveLength(1)
  })

  it("releases the claim and retries when delivery fails", async () => {
    const owner = await createUser()
    const task = await dueTask(owner, Date.UTC(2032, 1, 10, 12))
    const body = { taskId: task.id, dueAt: task.dueAt }
    const { send, sent } = recorder(1)

    const failing = batchOf([{ id: "attempt-1", body }])
    await processReminderBatch(failing, { appOrigin, database: env.DB, send })
    const failed = await getQueueResult(failing, createExecutionContext())

    expect(failed.retryMessages).toEqual([{ msgId: "attempt-1" }])
    expect(failed.explicitAcks).toEqual([])
    expect((await getTask(owner, task.id, env.DB))?.reminderSentAt).toBeNull()

    const retried = batchOf([{ id: "attempt-1", body, attempts: 2 }])
    await processReminderBatch(retried, { appOrigin, database: env.DB, send })
    expect(sent).toHaveLength(1)
    expect((await getTask(owner, task.id, env.DB))?.reminderSentAt).toEqual(
      expect.any(Number)
    )
  })

  it("skips stale, finished, unverified, and invalid messages", async () => {
    const owner = await createUser()
    const moved = await dueTask(owner, Date.UTC(2032, 2, 10, 12))
    const finished = await dueTask(owner, Date.UTC(2032, 2, 11, 12))
    await env.DB.prepare("UPDATE task SET status = 'done' WHERE id = ?")
      .bind(finished.id)
      .run()
    const unverified = await createUser(false)
    const hidden = await dueTask(unverified, Date.UTC(2032, 2, 12, 12))
    const { send, sent } = recorder()

    const batch = batchOf([
      // Enqueued before the due date moved a day later.
      {
        id: "stale",
        body: { taskId: moved.id, dueAt: Date.UTC(2032, 2, 9, 12) },
      },
      { id: "done", body: { taskId: finished.id, dueAt: finished.dueAt } },
      { id: "unverified", body: { taskId: hidden.id, dueAt: hidden.dueAt } },
      { id: "missing", body: { taskId: "no-such-task", dueAt: 1 } },
      { id: "invalid", body: { task: "nope" } },
    ])
    await processReminderBatch(batch, { appOrigin, database: env.DB, send })
    const result = await getQueueResult(batch, createExecutionContext())

    expect(sent).toEqual([])
    expect(result.explicitAcks).toEqual([
      "stale",
      "done",
      "unverified",
      "missing",
      "invalid",
    ])
    expect((await getTask(owner, moved.id, env.DB))?.reminderSentAt).toBeNull()
  })
})

describe("due-date formatting", () => {
  it("renders the chosen calendar date", () => {
    expect(formatDueDate(Date.UTC(2032, 0, 10, 12))).toBe(
      "Saturday, January 10"
    )
  })
})
