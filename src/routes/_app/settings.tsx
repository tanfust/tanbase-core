import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { LaptopIcon, MoonIcon, SunIcon } from "lucide-react"

import { siteConfig } from "@/lib/site"
import { submitHandler, useAppForm, validateOnSubmit } from "@/components/form"
import { useTheme } from "@/components/theme-provider"
import type { Theme } from "@/components/theme-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { authClient } from "@/modules/auth/client"
import {
  changePasswordFormSchema,
  changePasswordSchema,
  updateProfileSchema,
} from "@/modules/auth/schemas"
import { seo } from "@/modules/seo/head"

export const Route = createFileRoute("/_app/settings")({
  head: () =>
    seo({
      title: "Settings",
      description: `Manage your ${siteConfig.name} account.`,
      noindex: true,
    }),
  component: SettingsPage,
})

function SettingsPage() {
  const { session } = Route.useRouteContext()
  const { theme, setTheme } = useTheme()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and how {siteConfig.shortName} looks on this
          device.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your name appears in the account menu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* A new name from the server starts a fresh form. */}
          <ProfileForm
            key={session.user.name}
            name={session.user.name}
            email={session.user.email}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Changing your password signs out other active sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Stored locally on this device.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ToggleGroup
            value={[theme]}
            onValueChange={(values) => {
              const value = values[0]
              if (value) setTheme(value as Theme)
            }}
            variant="outline"
            spacing={0}
            aria-label="Appearance"
          >
            <ToggleGroupItem value="light" aria-label="Light theme">
              <SunIcon data-icon="inline-start" /> Light
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" aria-label="Dark theme">
              <MoonIcon data-icon="inline-start" /> Dark
            </ToggleGroupItem>
            <ToggleGroupItem value="system" aria-label="System theme">
              <LaptopIcon data-icon="inline-start" /> System
            </ToggleGroupItem>
          </ToggleGroup>
          <Alert>
            <AlertTitle>System theme</AlertTitle>
            <AlertDescription>
              Follows your operating system and updates automatically when its
              preference changes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}

function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: { name },
    validationLogic: validateOnSubmit,
    validators: { onDynamic: updateProfileSchema },
    onSubmit: async ({ value }) => {
      setError(null)
      const result = await authClient.updateUser(
        updateProfileSchema.parse(value)
      )
      if (result.error) {
        setError(result.error.message ?? "Unable to update your profile")
        return
      }
      await router.invalidate()
      toast.add({ type: "success", title: "Profile updated" })
    },
  })

  return (
    <form method="post" onSubmit={submitHandler(form)}>
      <FieldGroup>
        <form.AppField name="name">
          {(field) => (
            <field.TextField
              id="settings-name"
              label="Name"
              maxLength={80}
              required
            />
          )}
        </form.AppField>
        {error && <FieldError>{error}</FieldError>}
        <Field data-disabled>
          <FieldLabel htmlFor="settings-email">Email</FieldLabel>
          <Input id="settings-email" value={email} disabled />
          <FieldDescription>
            Email changes are not part of this release.
          </FieldDescription>
        </Field>
        <Field orientation="horizontal">
          <form.AppForm>
            <form.SubmitButton pendingLabel="Saving…">
              Save profile
            </form.SubmitButton>
          </form.AppForm>
        </Field>
      </FieldGroup>
    </form>
  )
}

function PasswordForm() {
  const [error, setError] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: { currentPassword: "", newPassword: "", confirmation: "" },
    validationLogic: validateOnSubmit,
    validators: { onDynamic: changePasswordFormSchema },
    onSubmit: async ({ value, formApi }) => {
      setError(null)
      const result = await authClient.changePassword({
        ...changePasswordSchema.parse(value),
        revokeOtherSessions: true,
      })
      if (result.error) {
        setError(
          result.error.message ?? "The current password was not accepted."
        )
        return
      }
      formApi.reset()
      toast.add({
        type: "success",
        title: "Password updated",
        description: "Other sessions were signed out.",
      })
    },
  })

  return (
    <form method="post" onSubmit={submitHandler(form)}>
      <FieldGroup>
        <form.AppField name="currentPassword">
          {(field) => (
            <field.TextField
              id="current-password"
              label="Current password"
              type="password"
              autoComplete="current-password"
              required
            />
          )}
        </form.AppField>
        <form.AppField name="newPassword">
          {(field) => (
            <field.TextField
              id="new-password"
              label="New password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          )}
        </form.AppField>
        <form.AppField name="confirmation">
          {(field) => (
            <field.TextField
              id="confirm-password"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          )}
        </form.AppField>
        {error && <FieldError>{error}</FieldError>}
        <Field orientation="horizontal">
          <form.AppForm>
            <form.SubmitButton pendingLabel="Updating…">
              Update password
            </form.SubmitButton>
          </form.AppForm>
        </Field>
      </FieldGroup>
    </form>
  )
}
