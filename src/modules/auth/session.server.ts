import { memoizeForRequest } from "@/platform/request-context"

import { getAuth } from "./auth.server"

/**
 * The session these headers carry. A server render asks for it from the
 * layout and from each server function it calls, so a request looks it up
 * once per cookie.
 */
export function getSessionFromHeaders(headers: Headers) {
  const key = [
    "session",
    headers.get("cookie") ?? "",
    headers.get("authorization") ?? "",
  ].join("\u0000")
  return memoizeForRequest(key, () => getAuth().api.getSession({ headers }))
}
