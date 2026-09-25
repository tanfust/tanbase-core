import { useEffect, useRef, useState } from "react"
import type { QueryKey } from "@tanstack/react-query"
import { useQueryClient } from "@tanstack/react-query"

import type { BoardSnapshot } from "@/modules/tasks/contracts"

import { applyBoardEvent, parseBoardEvent } from "./events"
import type { BoardEvent } from "./events"

export type RealtimeStatus = "connecting" | "live" | "reconnecting"

const heartbeatMs = 30_000
const maxBackoffMs = 30_000

interface BoardRealtimeOptions {
  /** Query key of the board snapshot the page renders. */
  queryKey: QueryKey
  /** The active project's ID, which names its room. */
  projectId: string | null
  /** Project renames and deletions also change the navigation. */
  onProjectEvent?: (event: BoardEvent) => void
}

/**
 * Keeps a board in sync across devices. Events update the cached snapshot in
 * place; after any reconnect the board refetches, so missed events are never
 * silently lost.
 */
export function useBoardRealtime({
  queryKey,
  projectId,
  onProjectEvent,
}: BoardRealtimeOptions): RealtimeStatus {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<RealtimeStatus>("connecting")
  const onProjectEventRef = useRef(onProjectEvent)
  onProjectEventRef.current = onProjectEvent
  const keyRef = useRef(queryKey)
  keyRef.current = queryKey

  useEffect(() => {
    if (!projectId) return

    let socket: WebSocket | null = null
    let heartbeat: ReturnType<typeof setInterval> | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    let connectedBefore = false
    let stopped = false

    const connect = () => {
      const url = new URL(
        `/api/realtime/${encodeURIComponent(projectId)}`,
        window.location.href
      )
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
      setStatus(connectedBefore ? "reconnecting" : "connecting")
      socket = new WebSocket(url)

      socket.onopen = () => {
        if (connectedBefore) {
          void queryClient.invalidateQueries({ queryKey: keyRef.current })
        }
        connectedBefore = true
        attempt = 0
        setStatus("live")
        heartbeat = setInterval(() => socket?.send("ping"), heartbeatMs)
      }

      socket.onmessage = (message) => {
        const event = parseBoardEvent(message.data)
        if (!event) return
        queryClient.setQueryData<BoardSnapshot>(keyRef.current, (snapshot) =>
          applyBoardEvent(snapshot, event)
        )
        if (
          event.type === "project.renamed" ||
          event.type === "project.deleted"
        ) {
          onProjectEventRef.current?.(event)
        }
      }

      socket.onclose = () => {
        clearInterval(heartbeat)
        if (stopped) return
        setStatus("reconnecting")
        const delay =
          Math.min(maxBackoffMs, 1000 * 2 ** attempt) *
          (0.5 + Math.random() / 2)
        attempt += 1
        retry = setTimeout(connect, delay)
      }

      socket.onerror = () => socket?.close()
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(retry)
      clearInterval(heartbeat)
      socket?.close(1000)
    }
  }, [projectId, queryClient])

  return status
}
