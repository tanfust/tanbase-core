import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

// For page renders: an unfinished deployment reads as signed out, so the
// sign-in pages can say what it is missing (see getPageSession).
export const getSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getPageSession } = await import("./session.server")
    return getPageSession(getRequestHeaders())
  }
)
