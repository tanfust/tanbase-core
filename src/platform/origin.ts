import { env } from "cloudflare:workers"

import { getRequestContext } from "./request-context"

/**
 * The origin of a configured `BETTER_AUTH_URL` value, or null when it is unset.
 * A value that is set but is not a URL throws, so a typo fails loudly
 * instead of silently falling back to the request's origin.
 */
export function configuredOrigin(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    throw new Error("BETTER_AUTH_URL must be an absolute URL")
  }
}

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
