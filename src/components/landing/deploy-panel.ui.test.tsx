import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { homepage } from "@/modules/seo/homepage"

import { DeployPanel } from "./deploy-panel"

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  })
}

afterEach(() => {
  cleanup()
  delete (navigator as { clipboard?: unknown }).clipboard
})

describe("deploy panel", () => {
  it("shows each install command and links to the install guide", () => {
    render(<DeployPanel />)

    for (const command of homepage.deploy.commands) {
      expect(screen.getByText(command)).toBeTruthy()
    }
    expect(
      screen
        .getByRole("link", { name: homepage.deploy.guide.label })
        .getAttribute("href")
    ).toBe(homepage.deploy.guide.href)
  })

  it("copies the commands without prompts and confirms it", async () => {
    const writeText = vi.fn(() => Promise.resolve())
    stubClipboard(writeText)
    render(<DeployPanel />)

    fireEvent.click(screen.getByRole("button", { name: "Copy" }))

    expect(writeText).toHaveBeenCalledWith(homepage.deploy.commands.join("\n"))
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy()
    })
  })

  it("stays on Copy when the clipboard refuses", async () => {
    stubClipboard(() => Promise.reject(new Error("denied")))
    render(<DeployPanel />)

    fireEvent.click(screen.getByRole("button", { name: "Copy" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy()
    })
  })
})
