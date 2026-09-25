import { env } from "cloudflare:workers"
import { createFileRoute } from "@tanstack/react-router"

import { getSessionFromHeaders } from "@/modules/auth/session.server"
import {
  getFilesBucket,
  handleAttachmentUpload,
} from "@/modules/files/storage.server"

export const Route = createFileRoute("/api/tasks/$taskId/attachments")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = await getSessionFromHeaders(request.headers)
        return handleAttachmentUpload(request, params.taskId, {
          appOrigin: new URL(env.BETTER_AUTH_URL).origin,
          bucket: getFilesBucket(),
          userId: session?.user.id ?? null,
        })
      },
    },
  },
})
