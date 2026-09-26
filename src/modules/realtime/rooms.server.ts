import { env, waitUntil } from "cloudflare:workers"

import { log } from "@/platform/log"

import type { BoardRoom } from "./board-room.server"
import type { BoardEvent } from "./events"

type BoardNamespace = DurableObjectNamespace<BoardRoom>

/** The BOARD namespace, or null when the installation has no binding. */
export function getBoardNamespace(): BoardNamespace | null {
  return (env as { BOARD?: BoardNamespace }).BOARD ?? null
}

// Rooms are scoped to the owner as well as the project, so a socket can only
// ever join its own owner's room, even if a project ID is guessed.
export function boardRoomName(userId: string, projectId: string) {
  return `${userId}:${projectId}`
}

/**
 * Publishes an event after its D1 write succeeded. Delivery runs after the
 * response and never fails the mutation; clients refetch after reconnecting.
 */
export function publishBoardEvent(
  userId: string,
  projectId: string,
  event: BoardEvent,
  namespace: BoardNamespace | null = getBoardNamespace()
) {
  if (!namespace) return
  const room = namespace.getByName(boardRoomName(userId, projectId))
  waitUntil(
    room.broadcast(event).then(
      () => undefined,
      (error: unknown) => {
        log.warn("Board event was not delivered", {
          event: "realtime.broadcast_failed",
          type: event.type,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    )
  )
}

/**
 * Delivers events and waits for the room, for callers with no response to
 * outlive, such as workflow steps. Returns the number of sockets reached.
 */
export async function broadcastBoardEvents(
  userId: string,
  projectId: string,
  events: BoardEvent[],
  namespace: BoardNamespace | null = getBoardNamespace()
): Promise<number> {
  if (!namespace) return 0
  const room = namespace.getByName(boardRoomName(userId, projectId))
  let delivered = 0
  for (const event of events) delivered += await room.broadcast(event)
  return delivered
}

interface UpgradeDependencies {
  appOrigin: string
  namespace: BoardNamespace | null
  ownsProject: (userId: string, projectId: string) => Promise<boolean>
  userId: string | null
}

function problem(status: number, message: string) {
  return new Response(message, {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" },
  })
}

/** Guards `GET /api/realtime/:projectId` before handing the socket to a room. */
export async function handleRealtimeUpgrade(
  request: Request,
  projectId: string,
  { appOrigin, namespace, ownsProject, userId }: UpgradeDependencies
): Promise<Response> {
  if (
    request.method !== "GET" ||
    request.headers.get("Upgrade")?.toLowerCase() !== "websocket"
  ) {
    return problem(426, "Expected a WebSocket upgrade.")
  }
  // Browsers always send Origin on WebSocket handshakes; checking it stops
  // other sites from opening sockets with the user's cookie.
  if (request.headers.get("Origin") !== appOrigin) {
    return problem(403, "Realtime connections must come from this site.")
  }
  if (!userId) return problem(401, "Sign in to connect.")
  if (!namespace) return problem(503, "Realtime is not enabled.")
  if (!projectId || !(await ownsProject(userId, projectId))) {
    return problem(404, "Project not found.")
  }

  return namespace.getByName(boardRoomName(userId, projectId)).fetch(request)
}
