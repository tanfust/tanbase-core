import { env } from "cloudflare:workers"
import { describe, expect, it, vi } from "vitest"

import { createEmailSender } from "./send-email.server"

const input = {
  props: {
    verificationUrl: "https://example.com/verify?token=secret-token",
  },
  subject: "Verify your email",
  template: "verifyEmail",
  to: "person@example.com",
} as const

describe("sendEmail", () => {
  it("logs safe metadata when no sender is configured", async () => {
    const info = vi.fn()
    const send = createEmailSender({
      environment: {
        EMAIL: { send: vi.fn() },
      },
      logger: { info },
    })

    await expect(send(input)).resolves.toEqual({
      delivery: "logged",
      id: null,
    })
    expect(info).toHaveBeenCalledWith(
      "Email delivery logged without sending.",
      {
        event: "email.logged",
        recipientCount: 1,
        template: "verifyEmail",
      }
    )
    expect(JSON.stringify(info.mock.calls)).not.toContain("secret-token")
    expect(JSON.stringify(info.mock.calls)).not.toContain("person@example.com")
  })

  it("uses the Cloudflare Email binding when the sender is configured", async () => {
    const providerSend = vi.fn().mockResolvedValue({ messageId: "email-123" })
    const send = createEmailSender({
      environment: {
        EMAIL: { send: providerSend },
        EMAIL_FROM: "TanBase Core <hello@example.com>",
      },
      logger: { info: vi.fn() },
    })

    await expect(send(input)).resolves.toEqual({
      delivery: "sent",
      id: "email-123",
    })
    expect(providerSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "TanBase Core <hello@example.com>",
        subject: "Verify your email",
        to: "person@example.com",
      })
    )
    expect(providerSend.mock.calls[0]?.[0].html).toContain(
      "https://example.com/verify?token=secret-token"
    )
    expect(providerSend.mock.calls[0]?.[0].text).toMatch(
      /verify your email address/i
    )
  })

  it("sends through the simulated Workers binding", async () => {
    const send = createEmailSender({
      environment: {
        EMAIL: env.EMAIL,
        EMAIL_FROM: "TanBase Core <hello@example.com>",
      },
      logger: { info: vi.fn() },
    })

    await expect(send(input)).resolves.toEqual({
      delivery: "sent",
      id: expect.any(String),
    })
  })

  it("returns a safe error when the provider rejects delivery", async () => {
    const send = createEmailSender({
      environment: {
        EMAIL: {
          send: vi.fn().mockRejectedValue(new Error("provider details")),
        },
        EMAIL_FROM: "TanBase Core <hello@example.com>",
      },
      logger: { info: vi.fn() },
    })

    await expect(send(input)).rejects.toThrow("Email delivery failed")
  })
})
