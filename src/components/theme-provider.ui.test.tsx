import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider, useTheme } from "./theme-provider"

const listeners = new Set<() => void>()
let systemIsDark = false
let storage = new Map<string, string>()

function ThemeControls() {
  const { theme, setTheme } = useTheme()
  return (
    <button type="button" onClick={() => setTheme("dark")}>
      {theme}
    </button>
  )
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    storage = new Map()
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        key: (index: number) => [...storage.keys()][index] ?? null,
        get length() {
          return storage.size
        },
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    })
    window.localStorage.clear()
    document.documentElement.className = ""
    document.documentElement.style.colorScheme = ""
    listeners.clear()
    systemIsDark = false
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: systemIsDark,
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        addEventListener: (_type: string, listener: () => void) =>
          listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) =>
          listeners.delete(listener),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    )
  })

  it("restores and persists an explicit appearance", async () => {
    window.localStorage.setItem("tanbase-theme", "light")
    render(
      <ThemeProvider>
        <ThemeControls />
      </ThemeProvider>
    )

    await waitFor(() =>
      expect(screen.getByRole("button").textContent).toBe("light")
    )
    expect(document.documentElement.classList.contains("dark")).toBe(false)

    fireEvent.click(screen.getByRole("button"))
    expect(window.localStorage.getItem("tanbase-theme")).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe("dark")
  })
})
