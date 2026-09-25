import { env } from "cloudflare:workers"

import type { Attachment } from "@/db/schema"
import { log } from "@/platform/log"

import type { AttachmentView } from "./contracts"
import {
  isAllowedAttachmentType,
  maxAttachmentBytes,
  maxAttachmentNameLength,
  maxAttachmentsPerTask,
  normalizeContentType,
} from "./limits"
import {
  countTaskAttachments,
  createAttachment,
  getAttachment,
  getTaskScope,
} from "./repository.server"

/** The FILES bucket, or null when the installation has no R2 binding. */
export function getFilesBucket(): R2Bucket | null {
  return (env as { FILES?: R2Bucket }).FILES ?? null
}

export function attachmentKey(
  userId: string,
  taskId: string,
  attachmentId: string
) {
  return `u/${userId}/t/${taskId}/${attachmentId}`
}

export function toAttachmentView(attachment: Attachment): AttachmentView {
  return {
    id: attachment.id,
    taskId: attachment.taskId,
    filename: attachment.filename,
    size: attachment.size,
    contentType: attachment.contentType,
    createdAt: attachment.createdAt,
  }
}

/** Keeps only the final path segment and drops control characters. */
export function sanitizeFilename(raw: string): string | null {
  const lastSegment = raw.split(/[\\/]/).pop() ?? ""
  const name = [...lastSegment]
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code > 0x1f && code !== 0x7f
    })
    .join("")
    .trim()
  if (!name || name === "." || name === "..") return null
  return name.slice(0, maxAttachmentNameLength)
}

export function contentDisposition(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, "_")
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

function problem(status: number, code: string, message: string) {
  return Response.json(
    { code, message },
    { status, headers: { "Cache-Control": "no-store" } }
  )
}

interface FileDependencies {
  bucket: R2Bucket | null
  database?: D1Database
  userId: string | null
}

export async function handleAttachmentUpload(
  request: Request,
  taskId: string,
  {
    appOrigin,
    bucket,
    database,
    userId,
  }: FileDependencies & {
    appOrigin: string
  }
): Promise<Response> {
  // Cross-site requests cannot set this header to the app's origin, and the
  // session cookie is SameSite=Lax; both guard this non-server-function route.
  if (request.headers.get("Origin") !== appOrigin) {
    return problem(403, "FORBIDDEN_ORIGIN", "Uploads must come from this site.")
  }
  if (!userId) return problem(401, "UNAUTHORIZED", "Sign in to upload files.")
  if (!bucket) {
    return problem(503, "FILES_DISABLED", "File uploads are not enabled.")
  }

  const size = Number(request.headers.get("Content-Length"))
  if (!request.body || !Number.isSafeInteger(size) || size <= 0) {
    return problem(411, "LENGTH_REQUIRED", "Choose a non-empty file.")
  }
  if (size > maxAttachmentBytes) {
    return problem(413, "FILE_TOO_LARGE", "Files can be at most 10 MB.")
  }

  const contentType = normalizeContentType(request.headers.get("Content-Type"))
  if (!isAllowedAttachmentType(contentType)) {
    return problem(415, "UNSUPPORTED_TYPE", "This file type is not supported.")
  }

  let rawName = ""
  try {
    rawName = decodeURIComponent(request.headers.get("X-Attachment-Name") ?? "")
  } catch {
    // Malformed encoding is treated as a missing name.
  }
  const filename = sanitizeFilename(rawName)
  if (!filename) return problem(400, "INVALID_NAME", "The file needs a name.")

  const scope = await getTaskScope(userId, taskId, database)
  if (!scope) return problem(404, "TASK_NOT_FOUND", "Task not found.")
  if (
    (await countTaskAttachments(userId, taskId, database)) >=
    maxAttachmentsPerTask
  ) {
    return problem(
      409,
      "TOO_MANY_ATTACHMENTS",
      `A task can have at most ${maxAttachmentsPerTask} attachments.`
    )
  }

  const id = crypto.randomUUID()
  const key = attachmentKey(userId, taskId, id)

  let stored: R2Object | null = null
  try {
    // Streamed straight into R2; the runtime enforces the declared length.
    stored = await bucket.put(key, request.body, {
      httpMetadata: { contentType },
      customMetadata: { userId, taskId },
    })
  } catch {
    stored = null
  }
  if (!stored || stored.size !== size) {
    await bucket.delete(key)
    return problem(400, "INCOMPLETE_UPLOAD", "The upload did not complete.")
  }

  try {
    const attachment = await createAttachment(
      userId,
      {
        id,
        taskId,
        projectId: scope.projectId,
        r2Key: key,
        filename,
        size: stored.size,
        contentType,
      },
      database
    )
    return Response.json(toAttachmentView(attachment), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    await bucket.delete(key)
    log.error("Attachment record failed", {
      event: "attachment.record_failed",
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return problem(500, "UPLOAD_FAILED", "The file could not be saved.")
  }
}

export async function handleAttachmentDownload(
  attachmentId: string,
  { bucket, database, userId }: FileDependencies
): Promise<Response> {
  if (!userId) return problem(401, "UNAUTHORIZED", "Sign in to download files.")
  if (!bucket) return problem(503, "FILES_DISABLED", "Files are not enabled.")

  const attachment = await getAttachment(userId, attachmentId, database)
  if (!attachment) return problem(404, "NOT_FOUND", "File not found.")

  const object = await bucket.get(attachment.r2Key)
  if (!object) {
    log.warn("Attachment object missing", {
      event: "attachment.object_missing",
      attachmentId,
    })
    return problem(404, "NOT_FOUND", "File not found.")
  }

  return new Response(object.body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": contentDisposition(attachment.filename),
      "Content-Length": String(object.size),
      // Never render a download as a page, even if a browser tries to.
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Type": attachment.contentType,
      ETag: object.httpEtag,
    },
  })
}

/**
 * Deletes stored objects after their rows are gone. Failures are logged, not
 * thrown, because the user-visible delete has already succeeded.
 */
export async function removeStoredObjects(
  bucket: R2Bucket | null,
  keys: readonly string[]
): Promise<void> {
  if (!bucket || keys.length === 0) return
  try {
    for (let start = 0; start < keys.length; start += 1000) {
      await bucket.delete(keys.slice(start, start + 1000))
    }
  } catch (error) {
    log.error("Attachment cleanup failed", {
      event: "attachment.cleanup_failed",
      objects: keys.length,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
