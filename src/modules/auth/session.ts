import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

export const getSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getSessionFromHeaders } = await import("./session.server")
    return getSessionFromHeaders(getRequestHeaders())
  }
)
