export interface VerifyEmailProps {
  name?: string
  verificationUrl: string
  expiresInMinutes?: number
}

export interface ResetPasswordProps {
  name?: string
  resetUrl: string
  expiresInMinutes?: number
}

export interface MagicLinkProps {
  name?: string
  magicLinkUrl: string
  expiresInMinutes?: number
}

export interface TaskReminderProps {
  name?: string
  projectName: string
  taskTitle: string
  taskUrl: string
  dueAt?: string
}

export interface EmailTemplateProps {
  verifyEmail: VerifyEmailProps
  resetPassword: ResetPasswordProps
  magicLink: MagicLinkProps
  taskReminder: TaskReminderProps
}

export type EmailTemplate = keyof EmailTemplateProps

export type EmailTemplateInput = {
  [Template in EmailTemplate]: {
    template: Template
    props: EmailTemplateProps[Template]
  }
}[EmailTemplate]

export type SendEmailInput = EmailTemplateInput & {
  subject: string
  to: string | string[]
}

export interface RenderedEmail {
  html: string
  text: string
}

export type EmailDeliveryResult =
  { delivery: "logged"; id: null } | { delivery: "sent"; id: string }
