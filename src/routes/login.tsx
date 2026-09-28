import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { CheckCircle2Icon } from "lucide-react"

import { siteConfig } from "@/lib/site"
import { AuthShell } from "@/components/auth/auth-shell"
import { TurnstileField, useTurnstile } from "@/components/auth/turnstile"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { submitHandler, useAppForm, validateOnSubmit } from "@/components/form"
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
import { Spinner } from "@/components/ui/spinner"
import { getAuthChallengeConfig } from "@/modules/auth/challenge"
import { authClient } from "@/modules/auth/client"
import { authErrorMessage } from "@/modules/auth/errors"
import {
  authHref,
  hasOAuthQuery,
  oauthContinuation,
  safeRedirect,
} from "@/modules/auth/redirects"
import { emailRequestSchema, signInSchema } from "@/modules/auth/schemas"
import { seo } from "@/modules/seo/head"

interface LoginSearch {
  redirect?: string
  verified?: true
  error?: string
}

export const Route = createFileRoute("/login")({
  validateSearch: (search): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    verified:
      search.verified === true || search.verified === "true" ? true : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  loader: () => getAuthChallengeConfig(),
  head: () =>
    seo({
      title: "Sign in",
      description: `Sign in to your ${siteConfig.name} task board.`,
      noindex: true,
    }),
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  const { turnstileSiteKey, emailDelivery } = Route.useLoaderData()
  const captcha = useTurnstile(turnstileSiteKey)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    validationLogic: validateOnSubmit,
    validators: { onDynamic: signInSchema },
    onSubmit: async ({ value }) => {
      if (!captcha.ready) {
        setError("Complete the security check, then try again.")
        return
      }
      setError(null)
      const { email, password } = signInSchema.parse(value)
      const result = await authClient.signIn.email({
        email,
        password,
        fetchOptions: captcha.fetchOptions,
      })
      captcha.reset()
      if (result.error) {
        setError(authErrorMessage(result.error, "Unable to sign in"))
        return
      }
      // An MCP client sent the user here to sign in; resume its authorization.
      const next = hasOAuthQuery(window.location.search)
        ? oauthContinuation(result.data)
        : null
      if (next) {
        window.location.assign(next)
        return
      }
      await navigate({ to: safeRedirect(search.redirect) })
    },
  })

  async function resendVerification() {
    const parsed = emailRequestSchema.safeParse({
      email: form.getFieldValue("email"),
    })
    if (!parsed.success) {
      setError("Enter your email first, then resend the verification message.")
      return
    }
    if (!captcha.ready) {
      setError("Complete the security check, then try again.")
      return
    }
    setResending(true)
    const callbackURL = authHref("/login?verified=true", search.redirect)
    const result = await authClient.sendVerificationEmail({
      email: parsed.data.email,
      callbackURL,
      fetchOptions: captcha.fetchOptions,
    })
    setResending(false)
    captcha.reset()
    setError(
      result.error
        ? authErrorMessage(result.error, "Unable to resend verification")
        : "Verification email requested. Check your inbox."
    )
  }

  return (
    <AuthShell>
      {search.verified && (
        <Alert>
          <CheckCircle2Icon aria-hidden="true" />
          <AlertTitle>Email verified</AlertTitle>
          <AlertDescription>
            You can now sign in to your account.
          </AlertDescription>
        </Alert>
      )}
      {search.error && (
        <Alert variant="destructive">
          <AlertTitle>Verification failed</AlertTitle>
          <AlertDescription>
            The verification link is invalid or expired. Enter your email below
            and request another one.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            {emailDelivery
              ? "Sign in with your verified email."
              : "Sign in with your email and password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="post" onSubmit={submitHandler(form)}>
            <FieldGroup>
              <form.AppField name="email">
                {(field) => (
                  <field.TextField
                    id="email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                  />
                )}
              </form.AppField>
              <form.AppField name="password">
                {(field) => (
                  <field.TextField
                    id="password"
                    label="Password"
                    labelAction={
                      <Link
                        to="/forgot-password"
                        search={{ redirect: search.redirect }}
                        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    }
                    type="password"
                    autoComplete="current-password"
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
                    pendingLabel="Signing in…"
                  >
                    Sign in
                  </form.SubmitButton>
                </form.AppForm>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={resending}
                  onClick={resendVerification}
                  className="w-full"
                >
                  {resending && <Spinner data-icon="inline-start" />}
                  Resend verification
                </Button>
                <FieldDescription className="text-center">
                  New to {siteConfig.shortName}?{" "}
                  <Link to="/sign-up" search={{ redirect: search.redirect }}>
                    Create an account
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
