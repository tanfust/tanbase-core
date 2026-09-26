import { beforeEach, describe, expect, it, vi } from "vitest"

import { assetRecoverySource } from "./asset-recovery"

type Listener = (event: {
  target?: unknown
  preventDefault: () => void
}) => void

// A fresh window per test, so listeners and storage never leak between tests.
function fakeWindow() {
  const listeners = new Map<string, Listener>()
  const storage = new Map<string, string>()
  const win = {
    location: {
      href: "https://core.tanbase.dev/app",
      origin: "https://core.tanbase.dev",
    },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    addEventListener: (type: string, listener: Listener) =>
      listeners.set(type, listener),
  }
  const emit = (type: string, target?: unknown) => {
    const event = {
      target,
      defaultPrevented: false,
      preventDefault() {
        event.defaultPrevented = true
      },
    }
    listeners.get(type)?.(event)
    return event
  }
  return { emit, win }
}

const script = (src: string) => ({ tagName: "SCRIPT", src })
const link = (href: string) => ({ tagName: "LINK", href })

describe("asset recovery", () => {
  let reload: ReturnType<typeof vi.fn<() => void>>
  let page: ReturnType<typeof fakeWindow>

  beforeEach(() => {
    reload = vi.fn<() => void>()
    page = fakeWindow()
    const install = new Function(`return (${assetRecoverySource})`)() as (
      w: unknown,
      reload: () => void
    ) => void
    install(page.win, reload)
  })

  it("reloads once when a same-origin script or stylesheet fails", () => {
    page.emit("error", script("https://core.tanbase.dev/assets/main-abc.js"))
    expect(reload).toHaveBeenCalledTimes(1)

    page.emit("error", link("https://core.tanbase.dev/assets/styles-abc.css"))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("allows another reload after 30 seconds", () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(1_000_000)
      page.emit("error", script("/assets/main-abc.js"))
      vi.setSystemTime(1_000_000 + 30_001)
      page.emit("error", script("/assets/main-def.js"))
      expect(reload).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it("ignores other origins, other elements, and plain page errors", () => {
    page.emit("error", script("https://cdn.example.com/widget.js"))
    page.emit("error", { tagName: "IMG", src: "/assets/missing.png" })
    page.emit("error", page.win)
    page.emit("error")
    expect(reload).not.toHaveBeenCalled()
  })

  it("recovers from failed lazy chunks without surfacing the error", () => {
    const event = page.emit("vite:preloadError")
    expect(event.defaultPrevented).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("never reloads when session storage is unavailable", () => {
    page.win.sessionStorage.getItem = () => {
      throw new Error("blocked")
    }
    page.emit("error", script("/assets/main-abc.js"))
    expect(reload).not.toHaveBeenCalled()
  })
})
