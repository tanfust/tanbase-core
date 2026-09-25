import { z } from "zod"

export const taskAttachmentsInputSchema = z.object({
  taskId: z.string().min(1),
})

export const deleteAttachmentInputSchema = z.object({
  attachmentId: z.string().min(1),
})
