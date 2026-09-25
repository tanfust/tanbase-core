import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"

import { AuthShell } from "@/components/auth/auth-shell"
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/modules/auth/client"
import { authErrorMessage } from "@/modules/auth/errors"

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search): { token?: string; error?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token, error: tokenError } = Route.useSearch()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") ?? "")
    if (password !== String(form.get("confirmation") ?? "")) {
      setError("Passwords do not match.")
      return
    }
    if (!token) return
    setPending(true)
    setError(null)
    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    })
    setPending(false)
    if (result.error)
      setError(authErrorMessage(result.error, "Unable to reset the password"))
    else setSuccess(true)
  }

  const invalid = !token || Boolean(tokenError)

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Choose a new password</CardTitle>
          <CardDescription>Reset links expire after one hour.</CardDescription>
        </CardHeader>
        <CardContent>
          {invalid ? (
            <div className="flex flex-col gap-4">
              <Alert variant="destructive">
                <AlertTitle>Invalid reset link</AlertTitle>
                <AlertDescription>
                  Request a new link and try again.
                </AlertDescription>
              </Alert>
              <Button
                render={<Link to="/forgot-password" />}
                nativeButton={false}
              >
                Request another link
              </Button>
            </div>
          ) : success ? (
            <div className="flex flex-col gap-4">
              <Alert>
                <AlertTitle>Password updated</AlertTitle>
                <AlertDescription>
                  Sign in with your new password.
                </AlertDescription>
              </Alert>
              <Button render={<Link to="/login" />} nativeButton={false}>
                Sign in
              </Button>
            </div>
          ) : (
            <form method="post" onSubmit={submit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="password">New password</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirmation">
                    Confirm password
                  </FieldLabel>
                  <Input
                    id="confirmation"
                    name="confirmation"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </Field>
                {error && <FieldError>{error}</FieldError>}
                <Button type="submit" disabled={pending} className="w-full">
                  {pending && <Spinner data-icon="inline-start" />}
                  {pending ? "Updating password…" : "Update password"}
                </Button>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  )
}
