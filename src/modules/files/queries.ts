import { queryOptions } from "@tanstack/react-query"

import { getTaskAttachments } from "./functions"

export const taskAttachmentsQueryKey = (taskId: string) =>
  ["task-attachments", taskId] as const

export const taskAttachmentsQueryOptions = (taskId: string) =>
  queryOptions({
    queryKey: taskAttachmentsQueryKey(taskId),
    queryFn: () => getTaskAttachments({ data: { taskId } }),
    staleTime: 10_000,
  })
