import { useEffect } from "react"

import { scrubEventUrls } from "@/modules/analytics/privacy"
import type { AnalyticsConfig } from "@/modules/analytics/types"

let started = false

/**
 * Loads PostHog only when the installation configures a key. It runs without
 * cookies or browser storage, records page views, page leaves, uncaught
 * exceptions, and web vitals, loads no remote scripts, and strips query
 * strings and fragments from every URL, including those inside exception
 * messages and web vitals metrics.
 */
export function Analytics({ config }: { config: AnalyticsConfig | null }) {
  useEffect(() => {
    if (!config || started) return
    started = true

    // Exception capture and web vitals normally fetch their code from
    // PostHog's CDN, which the CSP and disable_external_dependency_loading
    // both block. Importing the bundled extensions first registers them, so
    // the SDK never fetches them.
    void Promise.all([
      import("posthog-js"),
      import("posthog-js/dist/exception-autocapture"),
      import("posthog-js/dist/web-vitals"),
    ]).then(([{ default: posthog }]) => {
      posthog.init(config.key, {
        api_host: config.host,
        cookieless_mode: "always",
        person_profiles: "identified_only",
        capture_pageview: "history_change",
        capture_pageleave: true,
        capture_exceptions: true,
        // Core Web Vitals without attribution, which would add element
        // selectors and resource URLs; network timing belongs to replay.
        capture_performance: {
          web_vitals: true,
          web_vitals_attribution: false,
          network_timing: false,
        },
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
