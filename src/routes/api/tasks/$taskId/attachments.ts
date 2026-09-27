import { createFileRoute } from "@tanstack/react-router"

import { getSessionFromHeaders } from "@/modules/auth/session.server"
import {
  getFilesBucket,
  handleAttachmentUpload,
} from "@/modules/files/storage.server"
import { requirePublicOrigin } from "@/platform/origin"

export const Route = createFileRoute("/api/tasks/$taskId/attachments")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = await getSessionFromHeaders(request.headers)
        return handleAttachmentUpload(request, params.taskId, {
          appOrigin: requirePublicOrigin(),
          bucket: getFilesBucket(),
          userId: session?.user.id ?? null,
        })
      },
    },
  },
})
