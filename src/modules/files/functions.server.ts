import { getRequestHeaders } from "@tanstack/react-start/server"

import { getSessionFromHeaders } from "@/modules/auth/session.server"

import type { TaskAttachments } from "./contracts"
import {
  deleteAttachment as deleteAttachmentRecord,
  getTaskScope,
  listTaskAttachments,
} from "./repository.server"
import type {
  deleteAttachmentInputSchema,
  taskAttachmentsInputSchema,
} from "./schemas"
import {
  getFilesBucket,
  removeStoredObjects,
  toAttachmentView,
} from "./storage.server"
import type { z } from "zod"

async function requireUserId() {
  const session = await getSessionFromHeaders(getRequestHeaders())
  if (!session) throw new Error("Unauthorized")
  return session.user.id
}

export async function getTaskAttachmentsImpl(
  input: z.infer<typeof taskAttachmentsInputSchema>
): Promise<TaskAttachments> {
  const userId = await requireUserId()
  if (!(await getTaskScope(userId, input.taskId))) {
    throw new Error("Task not found")
  }

  return {
    enabled: getFilesBucket() !== null,
    attachments: (await listTaskAttachments(userId, input.taskId)).map(
      toAttachmentView
    ),
  }
}

export async function deleteAttachmentImpl(
  input: z.infer<typeof deleteAttachmentInputSchema>
) {
  const userId = await requireUserId()
  const key = await deleteAttachmentRecord(userId, input.attachmentId)
  if (!key) throw new Error("Attachment not found")
  await removeStoredObjects(getFilesBucket(), [key])
  return { id: input.attachmentId }
}
