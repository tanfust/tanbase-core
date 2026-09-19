import { render, toPlainText } from "react-email"

import {
  MagicLink,
  ResetPassword,
  TaskReminder,
  VerifyEmail,
} from "./templates"
import type { EmailTemplateInput, RenderedEmail } from "./types"

function getTemplate(input: EmailTemplateInput) {
  switch (input.template) {
    case "verifyEmail":
      return <VerifyEmail {...input.props} />
    case "resetPassword":
      return <ResetPassword {...input.props} />
    case "magicLink":
      return <MagicLink {...input.props} />
    case "taskReminder":
      return <TaskReminder {...input.props} />
  }
}

export async function renderEmail(
  input: EmailTemplateInput
): Promise<RenderedEmail> {
  const html = await render(getTemplate(input))

  return {
    html,
    text: toPlainText(html),
  }
}
