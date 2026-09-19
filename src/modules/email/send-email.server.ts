import { env } from "cloudflare:workers"

import { renderEmail } from "./render"
import type { EmailDeliveryResult, SendEmailInput } from "./types"

interface EmailEnvironment {
  EMAIL: SendEmail
  EMAIL_FROM?: string
}

interface EmailLogger {
  info: (message: string, context: Record<string, unknown>) => void
}

interface EmailSenderDependencies {
  environment: EmailEnvironment
  logger: EmailLogger
}

const defaultDependencies: EmailSenderDependencies = {
  environment: env,
  logger: console,
}

function recipientCount(to: string | string[]) {
  return Array.isArray(to) ? to.length : 1
}

function logEmail(
  input: SendEmailInput,
  logger: EmailLogger
): EmailDeliveryResult {
  logger.info("Email delivery logged without sending.", {
    event: "email.logged",
    recipientCount: recipientCount(input.to),
    template: input.template,
  })

  return { delivery: "logged", id: null }
}

export function createEmailSender(
  dependencies: EmailSenderDependencies
): (input: SendEmailInput) => Promise<EmailDeliveryResult> {
  return async (input) => {
    const { environment, logger } = dependencies

    if (!environment.EMAIL_FROM) {
      return logEmail(input, logger)
    }

    const rendered = await renderEmail(input)
    try {
      const response = await environment.EMAIL.send({
        from: environment.EMAIL_FROM,
        html: rendered.html,
        subject: input.subject,
        text: rendered.text,
        to: input.to,
      })

      return { delivery: "sent", id: response.messageId }
    } catch {
      throw new Error("Email delivery failed")
    }
  }
}

export async function sendEmail(
  input: SendEmailInput
): Promise<EmailDeliveryResult> {
  return createEmailSender(defaultDependencies)(input)
}
