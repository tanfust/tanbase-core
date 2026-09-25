import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import {
  createProject,
  createTask,
  deleteProject,
  deleteTask,
} from "@/modules/tasks/repository.server"

import { maxAttachmentBytes, maxAttachmentsPerTask } from "./limits"
import {
  listAttachmentKeysForProject,
  listAttachmentKeysForTaskTree,
  listTaskAttachments,
} from "./repository.server"
import {
  contentDisposition,
  handleAttachmentDownload,
  handleAttachmentUpload,
  removeStoredObjects,
  sanitizeFilename,
} from "./storage.server"

const appOrigin = "http://localhost:3000"

async function ownedTask(parentId?: string) {
  const userId = `user-${crypto.randomUUID()}`
  const project = await createProject(userId, { name: "Files" }, env.DB)
  const task = await createTask(
    userId,
    { projectId: project.id, title: "Attach", parentId },
    env.DB
  )
  return { userId, projectId: project.id, taskId: task.id }
}

function uploadRequest(
  body: string,
  {
    name = "notes.txt",
    type = "text/plain",
    origin = appOrigin,
    length = String(new TextEncoder().encode(body).byteLength),
  }: { name?: string; type?: string; origin?: string; length?: string } = {}
) {
  return new Request(`${appOrigin}/api/tasks/any/attachments`, {
    method: "POST",
    headers: {
      "Content-Length": length,
      "Content-Type": type,
      Origin: origin,
      "X-Attachment-Name": encodeURIComponent(name),
    },
    body,
  })
}

function upload(
  request: Request,
  taskId: string,
  userId: string | null,
  bucket: R2Bucket | null = env.FILES
) {
  return handleAttachmentUpload(request, taskId, {
    appOrigin,
    bucket,
    database: env.DB,
    userId,
  })
}

async function storedKeys(userId: string) {
  const listed = await env.FILES.list({ prefix: `u/${userId}/` })
  return listed.objects.map((object) => object.key)
}

describe("attachment uploads", () => {
  it("streams an allowed file into R2 under the owner's task prefix", async () => {
    const { userId, taskId } = await ownedTask()

    const response = await upload(
      uploadRequest("hello attachments", { name: "C:\\docs\\notes café.txt" }),
      taskId,
      userId
    )

    expect(response.status).toBe(201)
    const view = await response.json<{ id: string; filename: string }>()
    expect(view).toMatchObject({
      taskId,
      filename: "notes café.txt",
      size: 17,
      contentType: "text/plain",
    })
    expect(await storedKeys(userId)).toEqual([
      `u/${userId}/t/${taskId}/${view.id}`,
    ])
    const object = await env.FILES.get(`u/${userId}/t/${taskId}/${view.id}`)
    expect(await object?.text()).toBe("hello attachments")
  })

  it("rejects unsafe requests before storing anything", async () => {
    const { userId, taskId } = await ownedTask()
    const other = await ownedTask()
    const cases: [Request, string, string | null, R2Bucket | null, number][] = [
      [
        uploadRequest("x", { origin: "https://evil.example" }),
        taskId,
        userId,
        env.FILES,
        403,
      ],
      [uploadRequest("x"), taskId, null, env.FILES, 401],
      [uploadRequest("x"), taskId, userId, null, 503],
      [
        uploadRequest("x", { length: String(maxAttachmentBytes + 1) }),
        taskId,
        userId,
        env.FILES,
        413,
      ],
      [
        uploadRequest("<svg/>", { type: "image/svg+xml" }),
        taskId,
        userId,
        env.FILES,
        415,
      ],
      [
        uploadRequest("<p>", { type: "text/html" }),
        taskId,
        userId,
        env.FILES,
        415,
      ],
      [uploadRequest("x", { name: "../" }), taskId, userId, env.FILES, 400],
      [uploadRequest("x"), other.taskId, userId, env.FILES, 404],
    ]

    for (const [request, target, user, bucket, status] of cases) {
      expect((await upload(request, target, user, bucket)).status).toBe(status)
    }
    expect(await storedKeys(userId)).toEqual([])
    expect(await storedKeys(other.userId)).toEqual([])
  })

  it(`caps a task at ${maxAttachmentsPerTask} attachments`, async () => {
    const { userId, taskId } = await ownedTask()

    for (let index = 0; index < maxAttachmentsPerTask; index += 1) {
      const response = await upload(
        uploadRequest(`file ${index}`, { name: `file-${index}.txt` }),
        taskId,
        userId
      )
      expect(response.status).toBe(201)
    }
    const response = await upload(uploadRequest("one more"), taskId, userId)

    expect(response.status).toBe(409)
    expect(await storedKeys(userId)).toHaveLength(maxAttachmentsPerTask)
  })
})

describe("attachment downloads", () => {
  it("streams the owner's file as a sandboxed attachment", async () => {
    const { userId, taskId } = await ownedTask()
    const created = await upload(
      uploadRequest("report", {
        name: "Q3 report.pdf",
        type: "application/pdf",
      }),
      taskId,
      userId
    )
    const { id } = await created.json<{ id: string }>()

    const response = await handleAttachmentDownload(id, {
      bucket: env.FILES,
      database: env.DB,
      userId,
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("report")
    expect(response.headers.get("Content-Type")).toBe("application/pdf")
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="Q3 report.pdf"; filename*=UTF-8''Q3%20report.pdf`
    )
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "default-src 'none'; sandbox"
    )
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  })

  it("hides other users' files and requires a session", async () => {
    const { userId, taskId } = await ownedTask()
    const created = await upload(uploadRequest("private"), taskId, userId)
    const { id } = await created.json<{ id: string }>()

    const otherUser = await handleAttachmentDownload(id, {
      bucket: env.FILES,
      database: env.DB,
      userId: `user-${crypto.randomUUID()}`,
    })
    const anonymous = await handleAttachmentDownload(id, {
      bucket: env.FILES,
      database: env.DB,
      userId: null,
    })

    expect(otherUser.status).toBe(404)
    expect(await otherUser.text()).not.toContain("private")
    expect(anonymous.status).toBe(401)
  })
})

describe("attachment cleanup", () => {
  it("leaves no objects after a task with a subtask is deleted", async () => {
    const parent = await ownedTask()
    const child = await createTask(
      parent.userId,
      { projectId: parent.projectId, title: "Child", parentId: parent.taskId },
      env.DB
    )
    await upload(uploadRequest("parent file"), parent.taskId, parent.userId)
    await upload(uploadRequest("child file"), child.id, parent.userId)

    const keys = await listAttachmentKeysForTaskTree(
      parent.userId,
      parent.taskId,
      env.DB
    )
    expect(keys).toHaveLength(2)
    expect(await deleteTask(parent.userId, parent.taskId, env.DB)).toBe(true)
    await removeStoredObjects(env.FILES, keys)

    expect(await listTaskAttachments(parent.userId, child.id, env.DB)).toEqual(
      []
    )
    expect(await storedKeys(parent.userId)).toEqual([])
  })

  it("leaves no objects after a project is deleted", async () => {
    const { userId, projectId, taskId } = await ownedTask()
    await upload(uploadRequest("one"), taskId, userId)
    await upload(uploadRequest("two", { name: "two.txt" }), taskId, userId)

    const keys = await listAttachmentKeysForProject(userId, projectId, env.DB)
    expect(keys).toHaveLength(2)
    expect(await deleteProject(userId, projectId, env.DB)).toBe(true)
    await removeStoredObjects(env.FILES, keys)

    expect(await listTaskAttachments(userId, taskId, env.DB)).toEqual([])
    expect(await storedKeys(userId)).toEqual([])
  })

  it("never lists another user's keys", async () => {
    const owner = await ownedTask()
    await upload(uploadRequest("mine"), owner.taskId, owner.userId)

    expect(
      await listAttachmentKeysForTaskTree(
        `user-${crypto.randomUUID()}`,
        owner.taskId,
        env.DB
      )
    ).toEqual([])
    expect(
      await listAttachmentKeysForProject(
        `user-${crypto.randomUUID()}`,
        owner.projectId,
        env.DB
      )
    ).toEqual([])
  })
})

describe("attachment names", () => {
  it("keeps the last path segment and strips control characters", () => {
    expect(sanitizeFilename("/tmp/a/b/report.pdf")).toBe("report.pdf")
    expect(sanitizeFilename("..\\..\\secret.txt")).toBe("secret.txt")
    expect(sanitizeFilename("bad\u0000name\u001f.txt")).toBe("badname.txt")
    expect(sanitizeFilename("  ")).toBeNull()
    expect(sanitizeFilename("..")).toBeNull()
    expect(sanitizeFilename("x".repeat(400))).toHaveLength(180)
  })

  it("encodes download names safely", () => {
    expect(contentDisposition('résumé "final".pdf')).toBe(
      `attachment; filename="r_sum_ _final_.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9%20%22final%22.pdf`
    )
  })
})
