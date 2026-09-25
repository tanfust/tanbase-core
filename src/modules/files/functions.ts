import { createServerFn } from "@tanstack/react-start"

import {
  deleteAttachmentInputSchema,
  taskAttachmentsInputSchema,
} from "./schemas"

export const getTaskAttachments = createServerFn({ method: "GET" })
  .validator(taskAttachmentsInputSchema)
  .handler(async ({ data }) => {
    const { getTaskAttachmentsImpl } = await import("./functions.server")
    return getTaskAttachmentsImpl(data)
  })

export const deleteAttachment = createServerFn({ method: "POST" })
  .validator(deleteAttachmentInputSchema)
  .handler(async ({ data }) => {
    const { deleteAttachmentImpl } = await import("./functions.server")
    return deleteAttachmentImpl(data)
  })
