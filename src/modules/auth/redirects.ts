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
