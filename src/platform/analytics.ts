import type { AnalyticsConfig } from "@/modules/analytics/types"

const defaultPostHogHost = "https://us.i.posthog.com"

interface AnalyticsEnvironment {
  POSTHOG_HOST?: string
  POSTHOG_KEY?: string
}

/**
 * Analytics is off unless the installation sets the POSTHOG_KEY Worker secret.
 * The key is public, but a secret keeps it per installation so forks never
 * report to this project.
 */
export function readAnalyticsConfig(
  environment: AnalyticsEnvironment
): AnalyticsConfig | null {
  const key = environment.POSTHOG_KEY?.trim()
  if (!key) return null

  try {
    const host = new URL(environment.POSTHOG_HOST || defaultPostHogHost)
    if (host.protocol !== "https:") return null
    return { key, host: host.origin }
  } catch {
    return null
  }
}

/**
 * Connect sources the browser needs for analytics. PostHog asks for the whole
 * posthog.com domain because its ingestion subdomains change over time.
 */
export function analyticsConnectSources(config: AnalyticsConfig | null) {
  if (!config) return []
  const { hostname, origin } = new URL(config.host)
  return hostname === "posthog.com" || hostname.endsWith(".posthog.com")
    ? ["https://*.posthog.com"]
    : [origin]
}
