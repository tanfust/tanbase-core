import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { SetupNotice } from "./setup-notice"

afterEach(cleanup)

describe("SetupNotice", () => {
  it("renders nothing on a finished deployment", () => {
    const { container } = render(<SetupNotice problem={null} />)
    expect(container.innerHTML).toBe("")
  })

  it("names the deploy command when the database has no tables", () => {
    render(<SetupNotice problem="database" />)
    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("This site is not set up yet")
    expect(alert.textContent).toContain("pnpm run deploy")
    expect(
      screen
        .getByRole("link", { name: "How to finish the deployment" })
        .getAttribute("href")
    ).toContain("DEPLOYMENT.md#importing-the-repository-from-the-dashboard")
  })

  it("names the secret when it is missing", () => {
    render(<SetupNotice problem="secret" />)
    expect(screen.getByRole("alert").textContent).toContain(
      "BETTER_AUTH_SECRET"
    )
  })
})
