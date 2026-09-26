const fallbackRedirect = "/app"

export function safeRedirect(value?: string) {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return fallbackRedirect
  }

  try {
    const url = new URL(value, "https://tanbase.local")
    return url.origin === "https://tanbase.local"
      ? `${url.pathname}${url.search}${url.hash}`
      : fallbackRedirect
  } catch {
    return fallbackRedirect
  }
}

export function authHref(path: string, redirect?: string) {
  const safe = safeRedirect(redirect)
  return safe === fallbackRedirect
    ? path
    : `${path}${path.includes("?") ? "&" : "?"}redirect=${encodeURIComponent(safe)}`
}

/**
 * True while the page carries a signed authorization query from an OAuth
 * client, such as an MCP client asking the user to sign in.
 */
export function hasOAuthQuery(search: string) {
  return new URLSearchParams(search).has("sig")
}

/**
 * The URL an OAuth-aware auth response asks the browser to open next, or null.
 * The OAuth provider returns `{ redirect: true, url }` to continue an
 * authorization, and `{ redirect_uri }` from consent.
 */
export function oauthContinuation(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const next =
    "redirect" in data && data.redirect === true && "url" in data
      ? data.url
      : "redirect_uri" in data
        ? data.redirect_uri
        : null
  return typeof next === "string" && /^https?:\/\//i.test(next) ? next : null
}
