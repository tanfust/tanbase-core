import { describe, expect, it } from "vitest"

import {
  scrubEventUrls,
  stripQueryAndFragment,
} from "@/modules/analytics/privacy"

import { analyticsConnectSources, readAnalyticsConfig } from "./analytics"
import { contentSecurityPolicy } from "./security-headers"

describe("analytics configuration", () => {
  it("stays off without a key and rejects unsafe hosts", () => {
    expect(readAnalyticsConfig({})).toBeNull()
    expect(readAnalyticsConfig({ POSTHOG_KEY: "  " })).toBeNull()
    expect(
      readAnalyticsConfig({
        POSTHOG_KEY: "phc_test",
        POSTHOG_HOST: "http://eu.i.posthog.com",
      })
    ).toBeNull()
    expect(
      readAnalyticsConfig({
        POSTHOG_KEY: "phc_test",
        POSTHOG_HOST: "not a url",
      })
    ).toBeNull()
  })

  it("defaults to the US host and normalizes custom hosts to an origin", () => {
    expect(readAnalyticsConfig({ POSTHOG_KEY: "phc_test" })).toEqual({
      key: "phc_test",
      host: "https://us.i.posthog.com",
    })
    expect(
      readAnalyticsConfig({
        POSTHOG_KEY: "phc_test",
        POSTHOG_HOST: "https://eu.i.posthog.com/",
      })
    ).toEqual({ key: "phc_test", host: "https://eu.i.posthog.com" })
  })

  it("opens connect-src only for the configured analytics origin", () => {
    expect(analyticsConnectSources(null)).toEqual([])
    expect(
      analyticsConnectSources({ key: "k", host: "https://eu.i.posthog.com" })
    ).toEqual(["https://*.posthog.com"])
    expect(
      analyticsConnectSources({ key: "k", host: "https://e.example.com" })
    ).toEqual(["https://e.example.com"])

    const policy = contentSecurityPolicy("n", {
      connectSources: ["https://*.posthog.com"],
      production: true,
    })
    expect(policy).toContain("connect-src 'self' https://*.posthog.com")
    expect(policy).toContain(
      "script-src 'self' 'nonce-n' https://challenges.cloudflare.com;"
    )
  })
})

describe("analytics privacy", () => {
  it("strips query strings and fragments from event URLs", () => {
    const event = {
      properties: {
        $current_url:
          "https://core.tanbase.dev/reset-password?token=secret#section",
        $referrer: "https://mail.example.com/inbox?u=person@example.com",
        $pathname: "/reset-password",
        other: "https://keep.example.com/?q=1",
      },
      $set_once: {
        $initial_current_url: "https://core.tanbase.dev/login?redirect=%2Fapp",
      },
    }

    const scrubbed = scrubEventUrls(event)

    expect(scrubbed.properties).toEqual({
      $current_url: "https://core.tanbase.dev/reset-password",
      $referrer: "https://mail.example.com/inbox",
      $pathname: "/reset-password",
      other: "https://keep.example.com/?q=1",
    })
    expect(scrubbed.$set_once.$initial_current_url).toBe(
      "https://core.tanbase.dev/login"
    )
    expect(JSON.stringify(scrubbed)).not.toContain("secret")
    expect(JSON.stringify(scrubbed)).not.toContain("person@example.com")
  })

  it("leaves non-URL values and empty events untouched", () => {
    expect(stripQueryAndFragment("$direct")).toBe("$direct")
    expect(stripQueryAndFragment(42)).toBe(42)
    expect(scrubEventUrls(null)).toBeNull()
  })
})
