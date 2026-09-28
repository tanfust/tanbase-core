import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"

import { siteConfig } from "@/lib/site"
import { AuthShell } from "@/components/auth/auth-shell"
import { SetupNotice } from "@/components/auth/setup-notice"
import { TurnstileField, useTurnstile } from "@/components/auth/turnstile"
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@/components/ui/field"
import { getAuthChallengeConfig } from "@/modules/auth/challenge"
import { authClient } from "@/modules/auth/client"
import { authErrorMessage } from "@/modules/auth/errors"
import { emailRequestSchema } from "@/modules/auth/schemas"
import { seo } from "@/modules/seo/head"

export const Route = createFileRoute("/forgot-password")({
  validateSearch: (search): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  loader: () => getAuthChallengeConfig(),
  head: () =>
    seo({
      title: "Reset your password",
      description: `Request a password reset link for your ${siteConfig.name} account.`,
      noindex: true,
    }),
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const { redirect } = Route.useSearch()
  const { turnstileSiteKey, emailDelivery, installationProblem } =
    Route.useLoaderData()
  const captcha = useTurnstile(turnstileSiteKey)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: { email: "" },
    validationLogic: validateOnSubmit,
    validators: { onDynamic: emailRequestSchema },
    onSubmit: async ({ value }) => {
      if (!captcha.ready) {
        setError("Complete the security check, then try again.")
        return
      }
      setError(null)
      const result = await authClient.requestPasswordReset({
        email: emailRequestSchema.parse(value).email,
        redirectTo: "/reset-password",
        fetchOptions: captcha.fetchOptions,
      })
      captcha.reset()
      if (result.error)
        setError(authErrorMessage(result.error, "Unable to request a reset"))
      else setSuccess(true)
    },
  })

  return (
    <AuthShell>
      <SetupNotice problem={installationProblem} />
      {!emailDelivery && (
        <Alert>
          <AlertTitle>This deployment does not send email</AlertTitle>
          <AlertDescription>
            A reset link cannot be emailed until email delivery is set up. If
            you are signed in, change your password in Settings.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription>
            {success
              ? "If the address belongs to an account, a reset link is on its way."
              : "Enter your account email to request a reset link."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <Button
              render={<Link to="/login" search={{ redirect }} />}
              nativeButton={false}
              className="w-full"
            >
              Return to sign in
            </Button>
          ) : (
            <form method="post" onSubmit={submitHandler(form)}>
              <FieldGroup>
                <form.AppField name="email">
                  {(field) => (
                    <field.TextField
                      id="email"
                      label="Email"
                      type="email"
                      autoComplete="email"
                      required
                    />
                  )}
                </form.AppField>
                <TurnstileField captcha={captcha} />
                {error && <FieldError>{error}</FieldError>}
                <Field>
                  <form.AppForm>
                    <form.SubmitButton
                      className="w-full"
                      pendingLabel="Requesting reset…"
                    >
                      Send reset link
                    </form.SubmitButton>
                  </form.AppForm>
                  <FieldDescription className="text-center">
                    <Link to="/login" search={{ redirect }}>
                      Return to sign in
                    </Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  )
}
