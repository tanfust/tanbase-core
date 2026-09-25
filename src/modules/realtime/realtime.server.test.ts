import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import type { BoardSnapshot, TaskView } from "@/modules/tasks/contracts"

import { applyBoardEvent, parseBoardEvent } from "./events"
import type { BoardEvent } from "./events"
import { boardRoomName, handleRealtimeUpgrade } from "./rooms.server"

const appOrigin = "http://localhost:3000"

function task(overrides: Partial<TaskView> = {}): TaskView {
  return {
    id: "task-1",
    projectId: "project-1",
    parentId: null,
    title: "Write docs",
    notes: null,
    status: "todo",
    position: 0,
    dueAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function board(tasks: TaskView[] = []): BoardSnapshot {
  const project = { id: "project-1", name: "Launch", createdAt: 1 }
  return { projects: [project], activeProject: project, tasks }
}

async function openSocket(roomName: string) {
  const response = await env.BOARD.getByName(roomName).fetch(
    "https://room.test/",
    { headers: { Upgrade: "websocket" } }
  )
  expect(response.status).toBe(101)
  const socket = response.webSocket
  if (!socket) throw new Error("The room did not return a socket")
  socket.accept()
  const messages: string[] = []
  socket.addEventListener("message", (event) => {
    messages.push(String(event.data))
  })
  return { socket, messages }
}

async function eventually(check: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("Condition was not met in time")
}

describe("board events", () => {
  it("parses only known event shapes", () => {
    expect(
      parseBoardEvent('{"type":"task.deleted","taskId":"a","projectId":"b"}')
    ).toEqual({
      type: "task.deleted",
      taskId: "a",
      projectId: "b",
    })
    expect(parseBoardEvent("pong")).toBeNull()
    expect(parseBoardEvent('{"type":"unknown"}')).toBeNull()
    expect(parseBoardEvent(42)).toBeNull()
  })

  it("upserts tasks and never replaces a newer copy", () => {
    const created = applyBoardEvent(board(), {
      type: "task.upserted",
      task: task(),
    })
    expect(created?.tasks).toHaveLength(1)

    const updated = applyBoardEvent(created, {
      type: "task.upserted",
      task: task({ status: "done", updatedAt: 5 }),
    })
    expect(updated?.tasks[0]?.status).toBe("done")

    const stale = applyBoardEvent(updated, {
      type: "task.upserted",
      task: task({ status: "doing", updatedAt: 3 }),
    })
    expect(stale?.tasks[0]?.status).toBe("done")
  })

  it("removes a deleted task with its subtasks and ignores other projects", () => {
    const snapshot = board([
      task({ id: "parent" }),
      task({ id: "child", parentId: "parent" }),
      task({ id: "grandchild", parentId: "child" }),
      task({ id: "sibling" }),
    ])

    const deleted = applyBoardEvent(snapshot, {
      type: "task.deleted",
      taskId: "parent",
      projectId: "project-1",
    })
    expect(deleted?.tasks.map((item) => item.id)).toEqual(["sibling"])

    const otherProject: BoardEvent = {
      type: "task.upserted",
      task: task({ id: "elsewhere", projectId: "project-2" }),
    }
    expect(applyBoardEvent(snapshot, otherProject)).toBe(snapshot)
  })

  it("renames the active project in place", () => {
    const renamed = applyBoardEvent(board(), {
      type: "project.renamed",
      project: { id: "project-1", name: "Launch v2", createdAt: 1 },
    })
    expect(renamed?.activeProject?.name).toBe("Launch v2")
    expect(renamed?.projects[0]?.name).toBe("Launch v2")
  })
})

describe("board rooms", () => {
  it("broadcasts to every socket in the room and only that room", async () => {
    const room = `test-${crypto.randomUUID()}`
    const first = await openSocket(room)
    const second = await openSocket(room)
    const outsider = await openSocket(`test-${crypto.randomUUID()}`)
    const event: BoardEvent = { type: "task.upserted", task: task() }

    expect(await env.BOARD.getByName(room).connections()).toBe(2)
    expect(await env.BOARD.getByName(room).broadcast(event)).toBe(2)
    await eventually(
      () => first.messages.length === 1 && second.messages.length === 1
    )

    expect(JSON.parse(first.messages[0] ?? "")).toEqual(event)
    expect(outsider.messages).toEqual([])
    for (const { socket } of [first, second, outsider]) socket.close(1000)
  })

  it("answers heartbeats and rejects non-upgrade requests", async () => {
    const room = `test-${crypto.randomUUID()}`
    const client = await openSocket(room)

    client.socket.send("ping")
    await eventually(() => client.messages.includes("pong"))

    const plain = await env.BOARD.getByName(room).fetch("https://room.test/")
    expect(plain.status).toBe(426)
    client.socket.close(1000)
  })
})

describe("realtime upgrade guard", () => {
  function upgrade(headers: Record<string, string>, method = "GET") {
    return new Request(`${appOrigin}/api/realtime/project-1`, {
      method,
      headers,
    })
  }

  const allowed = { Upgrade: "websocket", Origin: appOrigin }

  it("rejects everything except an owner's same-origin upgrade", async () => {
    const owns = (userId: string, projectId: string) =>
      Promise.resolve(userId === "owner" && projectId === "project-1")
    const cases: [Request, string | null, string, number][] = [
      [upgrade({ Origin: appOrigin }), "owner", "project-1", 426],
      [upgrade(allowed, "POST"), "owner", "project-1", 426],
      [
        upgrade({ ...allowed, Origin: "https://evil.example" }),
        "owner",
        "project-1",
        403,
      ],
      [upgrade({ Upgrade: "websocket" }), "owner", "project-1", 403],
      [upgrade(allowed), null, "project-1", 401],
      [upgrade(allowed), "intruder", "project-1", 404],
      [upgrade(allowed), "owner", "project-2", 404],
    ]

    for (const [request, userId, projectId, status] of cases) {
      const response = await handleRealtimeUpgrade(request, projectId, {
        appOrigin,
        namespace: env.BOARD,
        ownsProject: owns,
        userId,
      })
      expect(response.status, `${userId} ${projectId}`).toBe(status)
    }
  })

  it("joins the owner's room for an allowed upgrade", async () => {
    const response = await handleRealtimeUpgrade(
      upgrade(allowed),
      "project-1",
      {
        appOrigin,
        namespace: env.BOARD,
        ownsProject: () => Promise.resolve(true),
        userId: `owner-${crypto.randomUUID()}`,
      }
    )

    expect(response.status).toBe(101)
    response.webSocket?.accept()
    response.webSocket?.close(1000)
  })

  it("scopes rooms to the owner and the project", () => {
    expect(boardRoomName("user-a", "project-1")).not.toBe(
      boardRoomName("user-b", "project-1")
    )
  })
})
