import { describe, expect, it } from "vitest"

import { memoizeForRequest, runWithRequestContext } from "./request-context"

function inRequest<T>(callback: () => Promise<T>) {
  return runWithRequestContext(
    { requestId: "ray-1", nonce: "n", origin: "https://example.test" },
    callback
  )
}

describe("memoizeForRequest", () => {
  it("runs once per key within a request and shares the result", async () => {
    let calls = 0
    const compute = async () => ++calls

    const results = await inRequest(async () => {
      const [first, concurrent] = await Promise.all([
        memoizeForRequest("session", compute),
        memoizeForRequest("session", compute),
      ])
      const later = await memoizeForRequest("session", compute)
      const other = await memoizeForRequest("other", compute)
      return { first, concurrent, later, other }
    })

    expect(results).toEqual({ first: 1, concurrent: 1, later: 1, other: 2 })
    expect(calls).toBe(2)
  })

  it("does not share results between requests or outside one", async () => {
    let calls = 0
    const compute = async () => ++calls

    await inRequest(() => memoizeForRequest("session", compute))
    await inRequest(() => memoizeForRequest("session", compute))
    await memoizeForRequest("session", compute)
    await memoizeForRequest("session", compute)

    expect(calls).toBe(4)
  })

  it("retries after a failure", async () => {
    let calls = 0
    const results = await inRequest(async () => {
      const failed = await memoizeForRequest("session", async () => {
        calls++
        throw new Error("D1 unavailable")
      }).catch((error: Error) => error.message)
      const retried = await memoizeForRequest("session", async () => ++calls)
      return { failed, retried }
    })

    expect(results).toEqual({ failed: "D1 unavailable", retried: 2 })
  })
})
