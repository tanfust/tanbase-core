import { describe, expect, it } from "vitest"

import { authHref, safeRedirect, signedInDestination } from "./redirects"

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

  it("sends a signed-in visitor where they were headed, except mid-OAuth", () => {
    expect(signedInDestination(undefined, "")).toBe("/app")
    expect(signedInDestination("/settings", "?redirect=%2Fsettings")).toBe(
      "/settings"
    )
    expect(signedInDestination("https://example.com", "")).toBe("/app")
    expect(
      signedInDestination(undefined, "?client_id=claude&sig=signed-query")
    ).toBeNull()
  })
})
