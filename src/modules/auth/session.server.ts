import { env } from "cloudflare:workers"

import { memoizeForRequest } from "@/platform/request-context"

import { getAuth } from "./auth.server"
import { findInstallationProblem } from "./installation.server"

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

/**
 * The session for a page render. On an unfinished deployment, missing its
 * tables or its secret, the lookup throws; the page then renders signed out,
 * so the sign-in pages can say what is missing instead of failing.
 */
export async function getPageSession(
  headers: Headers,
  dependencies = {
    lookup: getSessionFromHeaders,
    problem: () => findInstallationProblem(env),
  }
) {
  try {
    return await dependencies.lookup(headers)
  } catch (error) {
    if (await dependencies.problem()) return null
    throw error
  }
}
