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

// An absolute URL or a root-relative path, then its query or fragment,
// leaving any sentence punctuation that follows.
const urlWithQuery =
  /((?:https?:\/\/[^\s?#"'<>]+)|(?:\/[^\s?#"'<>]*))[?#](?:[^\s"'<>]*[^\s"'<>.,;:!?)\]])?/g

/** Removes the query string and fragment from every URL quoted in `text`. */
export function stripQueriesInText(text: string): string {
  return text.replace(urlWithQuery, "$1")
}

interface ExceptionEntry {
  value?: unknown
  stacktrace?: { frames?: { filename?: unknown }[] }
}

// Exception messages and stack frames can quote the page URL, reset token
// included.
function scrubExceptions(list: unknown) {
  if (!Array.isArray(list)) return
  for (const entry of list as ExceptionEntry[]) {
    if (typeof entry.value === "string") {
      entry.value = stripQueriesInText(entry.value)
    }
    for (const frame of entry.stacktrace?.frames ?? []) {
      frame.filename = stripQueryAndFragment(frame.filename)
    }
  }
}

// Each web vitals metric carries the page URL again.
const metricUrlProperties = ["$current_url", "navigationURL"]
const webVitalsMetric = /^\$web_vitals_[A-Z]+_event$/

function scrubWebVitals(properties: Record<string, unknown>) {
  for (const [key, metric] of Object.entries(properties)) {
    if (!webVitalsMetric.test(key) || !metric || typeof metric !== "object") {
      continue
    }
    const fields = metric as Record<string, unknown>
    for (const field of metricUrlProperties) {
      if (field in fields) fields[field] = stripQueryAndFragment(fields[field])
    }
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
  if (event.properties) {
    scrubExceptions(event.properties.$exception_list)
    scrubWebVitals(event.properties)
  }
  return event
}
