import { queryOptions } from "@tanstack/react-query"

import { getBoard } from "./functions"

export const boardQueryKey = (projectId?: string) =>
  ["board", projectId ?? "first"] as const

export const boardQueryOptions = (projectId?: string) =>
  queryOptions({
    queryKey: boardQueryKey(projectId),
    queryFn: () => getBoard({ data: { projectId } }),
    staleTime: 10_000,
  })
