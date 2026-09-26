import type { CSSProperties, ReactNode } from "react"
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email"

import type {
  MagicLinkProps,
  ResetPasswordProps,
  TaskReminderProps,
  VerifyEmailProps,
} from "./types"

const colors = {
  background: "#f5f5f4",
  border: "#e7e5e4",
  button: "#18181b",
  muted: "#71717a",
  surface: "#ffffff",
  text: "#18181b",
} as const

const styles: Record<string, CSSProperties> = {
  body: {
    backgroundColor: colors.background,
    color: colors.text,
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    margin: 0,
    padding: "32px 12px",
  },
  button: {
    backgroundColor: colors.button,
    borderRadius: "8px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: "20px",
    padding: "12px 20px",
    textDecoration: "none",
  },
  container: {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: "12px",
    margin: "0 auto",
    maxWidth: "560px",
    padding: "32px",
  },
  eyebrow: {
    color: colors.muted,
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    margin: "0 0 16px",
    textTransform: "uppercase",
  },
  footer: {
    color: colors.muted,
    fontSize: "12px",
    lineHeight: "18px",
    margin: 0,
  },
  heading: {
    color: colors.text,
    fontSize: "24px",
    letterSpacing: "-0.02em",
    lineHeight: "32px",
    margin: "0 0 16px",
  },
  hr: {
    borderColor: colors.border,
    margin: "28px 0 20px",
  },
  paragraph: {
    color: colors.text,
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 16px",
  },
  section: {
    margin: "24px 0",
  },
}

interface EmailShellProps {
  actionLabel: string
  actionUrl: string
  children: ReactNode
  footer?: string
  preview: string
  title: string
}

function greeting(name?: string) {
  return name ? `Hi ${name},` : "Hello,"
}

function EmailShell({
  actionLabel,
  actionUrl,
  children,
  footer = "If you did not request this email, you can safely ignore it.",
  preview,
  title,
}: EmailShellProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.eyebrow}>TanBase Core</Text>
          <Heading style={styles.heading}>{title}</Heading>
          {children}
          <Section style={styles.section}>
            <Button href={actionUrl} style={styles.button}>
              {actionLabel}
            </Button>
          </Section>
          <Text style={styles.paragraph}>
            If the button does not work, copy and paste this link into your
            browser:
          </Text>
          <Link href={actionUrl}>{actionUrl}</Link>
          <Hr style={styles.hr} />
          <Text style={styles.footer}>{footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export function VerifyEmail({
  name,
  verificationUrl,
  expiresInMinutes = 60,
}: VerifyEmailProps) {
  return (
    <EmailShell
      actionLabel="Verify email"
      actionUrl={verificationUrl}
      preview="Verify your email address"
      title="Verify your email address"
    >
      <Text style={styles.paragraph}>{greeting(name)}</Text>
      <Text style={styles.paragraph}>
        Confirm this email address to finish creating your account. This link
        expires in {expiresInMinutes} minutes.
      </Text>
    </EmailShell>
  )
}

export function ResetPassword({
  name,
  resetUrl,
  expiresInMinutes = 30,
}: ResetPasswordProps) {
  return (
    <EmailShell
      actionLabel="Reset password"
      actionUrl={resetUrl}
      preview="Reset your password"
      title="Reset your password"
    >
      <Text style={styles.paragraph}>{greeting(name)}</Text>
      <Text style={styles.paragraph}>
        Use the link below to choose a new password. This link expires in{" "}
        {expiresInMinutes} minutes.
      </Text>
    </EmailShell>
  )
}

export function MagicLink({
  name,
  magicLinkUrl,
  expiresInMinutes = 10,
}: MagicLinkProps) {
  return (
    <EmailShell
      actionLabel="Sign in"
      actionUrl={magicLinkUrl}
      preview="Your secure sign-in link"
      title="Sign in to your account"
    >
      <Text style={styles.paragraph}>{greeting(name)}</Text>
      <Text style={styles.paragraph}>
        This one-time sign-in link expires in {expiresInMinutes} minutes.
      </Text>
    </EmailShell>
  )
}

export function TaskReminder({
  name,
  projectName,
  taskTitle,
  taskUrl,
  dueAt,
}: TaskReminderProps) {
  const timing = dueAt ? ` It is due ${dueAt}.` : ""

  return (
    <EmailShell
      actionLabel="View task"
      actionUrl={taskUrl}
      footer="TanBase sends one reminder when a task is due within a day. Mark the task done or clear its due date to skip it."
      preview={`Reminder: ${taskTitle}`}
      title="Task reminder"
    >
      <Text style={styles.paragraph}>{greeting(name)}</Text>
      <Text style={styles.paragraph}>
        “{taskTitle}” in {projectName} needs your attention.{timing}
      </Text>
    </EmailShell>
  )
}
