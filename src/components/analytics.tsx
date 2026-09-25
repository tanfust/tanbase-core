import { useEffect } from "react"

import { scrubEventUrls } from "@/modules/analytics/privacy"
import type { AnalyticsConfig } from "@/modules/analytics/types"

let started = false

/**
 * Loads PostHog only when the installation configures a key. It runs without
 * cookies or browser storage, records page views and page leaves only, loads
 * no remote scripts, and strips query strings and fragments from every URL.
 */
export function Analytics({ config }: { config: AnalyticsConfig | null }) {
  useEffect(() => {
    if (!config || started) return
    started = true

    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(config.key, {
        api_host: config.host,
        cookieless_mode: "always",
        person_profiles: "identified_only",
        capture_pageview: "history_change",
        capture_pageleave: true,
        autocapture: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_flags: true,
        disable_external_dependency_loading: true,
        mask_personal_data_properties: true,
        before_send: scrubEventUrls,
      })
    })
  }, [config])

  return null
}
