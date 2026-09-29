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

  it("reads a bare host as https", () => {
    expect(configuredOrigin("example.com")).toBe("https://example.com")
    expect(configuredOrigin(" app.example.com/ ")).toBe(
      "https://app.example.com"
    )
    expect(configuredOrigin("http://localhost:3000")).toBe(
      "http://localhost:3000"
    )
  })

  it("ignores a value that is not a web address instead of failing", () => {
    expect(configuredOrigin("not a url")).toBeNull()
    expect(configuredOrigin("ftp://example.com")).toBeNull()
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
