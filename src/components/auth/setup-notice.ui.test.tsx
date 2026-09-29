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

  it("says where sign-in works when BETTER_AUTH_URL names another address", () => {
    render(
      <SetupNotice
        problem={null}
        originMismatch={{
          configured: "https://klapt.ai",
          current: "https://klapt.example.workers.dev",
        }}
      />
    )
    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain(
      "Sign-in works only at https://klapt.ai"
    )
    expect(alert.textContent).toContain("https://klapt.example.workers.dev")
    expect(alert.textContent).toContain("BETTER_AUTH_URL")
  })

  it("names an unfinished deployment before an address mismatch", () => {
    render(
      <SetupNotice
        problem="database"
        originMismatch={{
          configured: "https://a.test",
          current: "https://b.test",
        }}
      />
    )
    expect(screen.getByRole("alert").textContent).toContain("no tables")
  })
})
