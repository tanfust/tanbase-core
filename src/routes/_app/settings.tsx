import { useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { LaptopIcon, MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import type { Theme } from "@/components/theme-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { authClient } from "@/modules/auth/client"

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings | TanBase Core" },
      { name: "description", content: "Manage your TanBase Core account." },
    ],
  }),
  component: SettingsPage,
})

function SettingsPage() {
  const { session } = Route.useRouteContext()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [profilePending, setProfilePending] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [passwordPending, setPasswordPending] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  async function updateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(
      new FormData(event.currentTarget).get("name") ?? ""
    ).trim()
    if (!name) {
      setProfileError("Enter your name.")
      return
    }
    setProfilePending(true)
    setProfileError(null)
    const result = await authClient.updateUser({ name })
    setProfilePending(false)
    if (result.error) {
      setProfileError(result.error.message ?? "Unable to update your profile")
      return
    }
    await router.invalidate()
    toast.add({ type: "success", title: "Profile updated" })
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const currentPassword = String(form.get("currentPassword") ?? "")
    const newPassword = String(form.get("newPassword") ?? "")
    if (newPassword !== String(form.get("confirmation") ?? "")) {
      setPasswordError("New passwords do not match.")
      return
    }
    if (newPassword.length < 8) {
      setPasswordError("Use at least 8 characters for the new password.")
      return
    }
    setPasswordPending(true)
    setPasswordError(null)
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    setPasswordPending(false)
    if (result.error) {
      setPasswordError(
        result.error.message ?? "The current password was not accepted."
      )
      return
    }
    formElement.reset()
    toast.add({
      type: "success",
      title: "Password updated",
      description: "Other sessions were signed out.",
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and how TanBase looks on this device.
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
          <form key={session.user.name} method="post" onSubmit={updateProfile}>
            <FieldGroup>
              <Field data-invalid={Boolean(profileError)}>
                <FieldLabel htmlFor="settings-name">Name</FieldLabel>
                <Input
                  id="settings-name"
                  name="name"
                  defaultValue={session.user.name}
                  maxLength={80}
                  aria-invalid={Boolean(profileError)}
                  required
                />
                {profileError && <FieldError>{profileError}</FieldError>}
              </Field>
              <Field data-disabled>
                <FieldLabel htmlFor="settings-email">Email</FieldLabel>
                <Input
                  id="settings-email"
                  value={session.user.email}
                  disabled
                />
                <FieldDescription>
                  Email changes are not part of this release.
                </FieldDescription>
              </Field>
              <Field orientation="horizontal">
                <Button type="submit" disabled={profilePending}>
                  {profilePending && <Spinner data-icon="inline-start" />}
                  {profilePending ? "Saving…" : "Save profile"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
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
          <form method="post" onSubmit={changePassword}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="current-password">
                  Current password
                </FieldLabel>
                <Input
                  id="current-password"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-password">New password</FieldLabel>
                <Input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">
                  Confirm new password
                </FieldLabel>
                <Input
                  id="confirm-password"
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Field>
              {passwordError && <FieldError>{passwordError}</FieldError>}
              <Field orientation="horizontal">
                <Button type="submit" disabled={passwordPending}>
                  {passwordPending && <Spinner data-icon="inline-start" />}
                  {passwordPending ? "Updating…" : "Update password"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
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
