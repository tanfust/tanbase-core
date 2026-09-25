import { createFileRoute } from "@tanstack/react-router"

import { getSessionFromHeaders } from "@/modules/auth/session.server"
import {
  getFilesBucket,
  handleAttachmentDownload,
} from "@/modules/files/storage.server"

export const Route = createFileRoute("/api/attachments/$attachmentId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await getSessionFromHeaders(request.headers)
        return handleAttachmentDownload(params.attachmentId, {
          bucket: getFilesBucket(),
          userId: session?.user.id ?? null,
        })
      },
    },
  },
})
