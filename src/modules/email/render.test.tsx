import { describe, expect, it } from "vitest"

import { renderEmail } from "./render"

describe("email templates", () => {
  it("renders the verify-email template", async () => {
    await expect(
      renderEmail({
        template: "verifyEmail",
        props: {
          name: "Amina",
          verificationUrl: "https://example.com/verify?token=verify-token",
        },
      })
    ).resolves.toMatchSnapshot()
  })

  it("renders the reset-password template", async () => {
    await expect(
      renderEmail({
        template: "resetPassword",
        props: {
          name: "Amina",
          resetUrl: "https://example.com/reset?token=reset-token",
        },
      })
    ).resolves.toMatchSnapshot()
  })

  it("renders the magic-link template", async () => {
    await expect(
      renderEmail({
        template: "magicLink",
        props: {
          magicLinkUrl: "https://example.com/sign-in?token=magic-token",
        },
      })
    ).resolves.toMatchSnapshot()
  })

  it("renders the task-reminder template", async () => {
    await expect(
      renderEmail({
        template: "taskReminder",
        props: {
          dueAt: "tomorrow at 09:00",
          name: "Amina",
          projectName: "Launch",
          taskTitle: "Review the release",
          taskUrl: "https://example.com/projects/launch/tasks/review",
        },
      })
    ).resolves.toMatchSnapshot()
  })
})
