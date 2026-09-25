import { DurableObject } from "cloudflare:workers"

import type { BoardEvent } from "./events"

/**
 * One room per owner and project. It relays events written to D1 and never
 * stores application data, so a restart loses nothing. Sockets are accepted
 * through the Hibernation API, heartbeats are answered by the runtime, and the
 * room sets no timers, so an idle room with open sockets can hibernate.
 */
export class BoardRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    )
  }

  fetch(request: Request): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade.", { status: 426 })
    }

    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  /** Sends an event to every open socket and returns how many received it. */
  broadcast(event: BoardEvent): number {
    const payload = JSON.stringify(event)
    let delivered = 0
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload)
        delivered += 1
      } catch {
        // A socket that is closing cannot send; the runtime drops it.
      }
    }
    return delivered
  }

  connections(): number {
    return this.ctx.getWebSockets().length
  }

  // Clients only send heartbeats, which the auto-response answers without
  // waking the room. Anything else is ignored.
  webSocketMessage(): void {}

  // The runtime completes the close handshake (web_socket_auto_reply_to_close).
  webSocketClose(): void {}
}
