import { getAuth } from "./auth.server"

export async function getSessionFromHeaders(headers: Headers) {
  return getAuth().api.getSession({ headers })
}
