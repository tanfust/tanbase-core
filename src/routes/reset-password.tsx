import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"

import { siteConfig } from "@/lib/site"
import { AuthShell } from "@/components/auth/auth-shell"
import { submitHandler, useAppForm, validateOnSubmit } from "@/components/form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldError, FieldGroup } from "@/components/ui/field"
import { authClient } from "@/modules/auth/client"
import { authErrorMessage } from "@/modules/auth/errors"
import {
  resetPasswordFormSchema,
  resetPasswordSchema,
} from "@/modules/auth/schemas"
import { seo } from "@/modules/seo/head"

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search): { token?: string; error?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  head: () =>
    seo({
      title: "Choose a new password",
      description: `Set a new password for your ${siteConfig.name} account.`,
      noindex: true,
    }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token, error: tokenError } = Route.useSearch()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useAppForm({
    defaultValues: { newPassword: "", confirmation: "" },
    validationLogic: validateOnSubmit,
    validators: { onDynamic: resetPasswordFormSchema },
    onSubmit: async ({ value }) => {
      if (!token) return
      setError(null)
      const result = await authClient.resetPassword({
        newPassword: resetPasswordSchema.parse(value).newPassword,
        token,
      })
      if (result.error)
        setError(authErrorMessage(result.error, "Unable to reset the password"))
      else setSuccess(true)
    },
  })

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
            <form method="post" onSubmit={submitHandler(form)}>
              <FieldGroup>
                <form.AppField name="newPassword">
                  {(field) => (
                    <field.TextField
                      id="password"
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
                      id="confirmation"
                      label="Confirm password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  )}
                </form.AppField>
                {error && <FieldError>{error}</FieldError>}
                <form.AppForm>
                  <form.SubmitButton
                    className="w-full"
                    pendingLabel="Updating password…"
                  >
                    Update password
                  </form.SubmitButton>
                </form.AppForm>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  )
}
