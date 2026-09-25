// URL properties that PostHog attaches to events and person records.
const urlProperties = [
  "$current_url",
  "$referrer",
  "$initial_current_url",
  "$initial_referrer",
]

/**
 * Removes query strings and fragments from a URL. Auth pages carry reset
 * tokens and redirect targets in the query, which must never leave the site.
 */
export function stripQueryAndFragment(value: unknown): unknown {
  if (typeof value !== "string") return value
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return value
  }
}

interface AnalyticsEvent {
  properties?: Record<string, unknown>
  $set?: Record<string, unknown>
  $set_once?: Record<string, unknown>
}

export function scrubEventUrls<T extends AnalyticsEvent | null>(event: T): T {
  if (!event) return event
  for (const bag of [event.properties, event.$set, event.$set_once]) {
    if (!bag) continue
    for (const key of urlProperties) {
      if (key in bag) bag[key] = stripQueryAndFragment(bag[key])
    }
  }
  return event
}
