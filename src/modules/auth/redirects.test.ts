import { describe, expect, it } from "vitest"

import { authHref, safeRedirect } from "./redirects"

describe("authentication redirects", () => {
  it("keeps local paths and query strings", () => {
    expect(safeRedirect("/app?project=one#task")).toBe("/app?project=one#task")
  })

  it("rejects absolute, protocol-relative, and malformed targets", () => {
    expect(safeRedirect("https://example.com/steal")).toBe("/app")
    expect(safeRedirect("//example.com/steal")).toBe("/app")
    expect(safeRedirect("not-a-path")).toBe("/app")
  })

  it("only adds a redirect parameter when it differs from the default", () => {
    expect(authHref("/login", "/app")).toBe("/login")
    expect(authHref("/login", "/settings")).toBe("/login?redirect=%2Fsettings")
    expect(authHref("/login?verified=true", "/settings")).toBe(
      "/login?verified=true&redirect=%2Fsettings"
    )
  })
})
