import { describe, expect, it } from "vitest"

import { appEnvironment } from "./environment"

describe("appEnvironment", () => {
  it("runs as production unless APP_ENV says local", () => {
    expect(appEnvironment("local")).toBe("local")
    expect(appEnvironment("production")).toBe("production")
    expect(appEnvironment("")).toBe("production")
  })

  // Without an argument it reads env.APP_ENV, which env.local sets.
  it("reads env.local's APP_ENV in the Worker tests", () => {
    expect(appEnvironment()).toBe("local")
  })
})
