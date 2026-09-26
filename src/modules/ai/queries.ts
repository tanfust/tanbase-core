import { queryOptions } from "@tanstack/react-query"

import { getAiStatus, getTaskBreakdown } from "./functions"

export const aiStatusQueryOptions = () =>
  queryOptions({
    queryKey: ["ai", "status"] as const,
    queryFn: () => getAiStatus(),
    staleTime: 30_000,
  })

/** Polls a breakdown run every two seconds until it finishes. */
export const breakdownQueryOptions = (instanceId: string) =>
  queryOptions({
    queryKey: ["ai", "breakdown", instanceId] as const,
    queryFn: () => getTaskBreakdown({ data: { instanceId } }),
    refetchInterval: (query) =>
      query.state.data?.state === "running" || !query.state.data ? 2000 : false,
  })
