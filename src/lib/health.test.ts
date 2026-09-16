import { describe, expect, it } from "vitest"

import { createHealthResponse, normalizeAppEnvironment } from "./health"

describe("health response", () => {
  it.each(["local", "preview", "production"] as const)(
    "returns the exact contract for %s",
    async (environment) => {
      const response = createHealthResponse(environment)

      expect(response.status).toBe(200)
      expect(response.headers.get("Cache-Control")).toBe("no-store")
      await expect(response.json()).resolves.toEqual({
        status: "ok",
        service: "tanbase-core",
        environment,
      })
    }
  )

  it("defaults unknown values to local", () => {
    expect(normalizeAppEnvironment("unknown")).toBe("local")
  })
})
