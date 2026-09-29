import { env } from "cloudflare:workers"

import { log } from "./log"
import { getRequestContext } from "./request-context"

/**
 * The origin of a configured `BETTER_AUTH_URL` value, or null when it is
 * unset or unusable. A bare host, such as `app.example.com`, means https.
 * Anything that is still not an http or https URL counts as unset, so the
 * site keeps running on each request's origin instead of failing every page
 * (ADR-0022); the Worker logs it.
 */
export function configuredOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol === "http:" || url.protocol === "https:") return url.origin
  } catch {
    // Falls through to the warning below.
  }
  if (!warnedInvalid) {
    warnedInvalid = true
    log.warn("BETTER_AUTH_URL is not a web address, so it is ignored.", {
      event: "origin.invalid_setting",
    })
  }
  return null
}

// Once per isolate: the origin is read on every request.
let warnedInvalid = false

/**
 * This deployment's public origin: `BETTER_AUTH_URL` when an installation
 * pins one, otherwise the origin the current request arrived on. A fresh
 * deploy on workers.dev therefore works without configuration. Null only
 * outside a request, such as in a cron or queue handler, when nothing is
 * configured.
 */
export function publicOrigin(): string | null {
  const configured = (env as { BETTER_AUTH_URL?: string }).BETTER_AUTH_URL
  return configuredOrigin(configured) ?? getRequestContext()?.origin ?? null
}

/** `publicOrigin()` for code that only runs during a request. */
export function requirePublicOrigin(): string {
  const origin = publicOrigin()
  if (!origin) throw new Error("The public origin is unknown")
  return origin
}
