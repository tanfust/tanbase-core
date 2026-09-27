import { describe, expect, it } from "vitest"

import { configuredOrigin, publicOrigin, requirePublicOrigin } from "./origin"
import { runWithRequestContext } from "./request-context"

describe("configured origin", () => {
  it("is null when BETTER_AUTH_URL is unset", () => {
    expect(configuredOrigin(undefined)).toBeNull()
    expect(configuredOrigin("")).toBeNull()
  })

  it("normalizes a configured URL to its origin", () => {
    expect(configuredOrigin("https://example.com/some/path")).toBe(
      "https://example.com"
    )
  })

  it("throws on a value that is not a URL instead of falling back", () => {
    expect(() => configuredOrigin("example.com")).toThrow(
      "BETTER_AUTH_URL must be an absolute URL"
    )
  })
})

describe("public origin", () => {
  it("prefers the configured origin over the request's", async () => {
    // The local test configuration sets BETTER_AUTH_URL.
    await runWithRequestContext(
      { nonce: "n", origin: "https://other.example", requestId: "r" },
      async () => {
        expect(publicOrigin()).toBe("http://localhost:3000")
        expect(requirePublicOrigin()).toBe("http://localhost:3000")
      }
    )
  })
})
