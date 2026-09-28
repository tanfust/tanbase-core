import { useState } from "react"
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { MailCheckIcon } from "lucide-react"

import { siteConfig } from "@/lib/site"
import { AuthShell } from "@/components/auth/auth-shell"
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
import {
  authHref,
  safeRedirect,
  signedInDestination,
} from "@/modules/auth/redirects"
import { signUpFormSchema, signUpSchema } from "@/modules/auth/schemas"
import { getSession } from "@/modules/auth/session"
import { seo } from "@/modules/seo/head"

interface SignUpSearch {
  redirect?: string
}

export const Route = createFileRoute("/sign-up")({
  validateSearch: (search): SignUpSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  // Someone already signed in goes where they were headed.
  beforeLoad: async ({ search, location }) => {
    const destination = signedInDestination(search.redirect, location.searchStr)
    if (destination && (await getSession())) {
      throw redirect({ href: destination })
    }
  },
  loader: () => getAuthChallengeConfig(),
  head: () =>
    seo({
      title: "Create your account",
      description: `Create a ${siteConfig.name} account and a private task board.`,
      noindex: true,
    }),
  component: SignUpPage,
})

function SignUpPage() {
  const { redirect: redirectPath } = Route.useSearch()
  const { turnstileSiteKey, emailDelivery } = Route.useLoaderData()
  const captcha = useTurnstile(turnstileSiteKey)
  const navigate = useNavigate()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: { name: "", email: "", password: "", confirmation: "" },
    validationLogic: validateOnSubmit,
    validators: { onDynamic: signUpFormSchema },
    onSubmit: async ({ value }) => {
      if (!captcha.ready) {
        setError("Complete the security check, then try again.")
        return
      }
      setError(null)
      const redirectTarget = safeRedirect(redirectPath)
      const account = signUpSchema.parse(value)
      const result = await authClient.signUp.email({
        ...account,
        callbackURL: `/login?verified=true&redirect=${encodeURIComponent(redirectTarget)}`,
        fetchOptions: captcha.fetchOptions,
      })
      captcha.reset()
      if (result.error) {
        setError(authErrorMessage(result.error, "Unable to create the account"))
        return
      }
      // Without email delivery there is nothing to verify: the account is
      // signed in, so go straight to the board.
      if (!emailDelivery) {
        await navigate({ to: redirectTarget })
        return
      }
      setSubmitted(true)
    },
  })

  return (
    <AuthShell>
      {submitted ? (
        <Card>
          <CardHeader>
            <MailCheckIcon aria-hidden="true" />
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription>
              Open the verification link before signing in.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Alert>
              <AlertTitle>Account created</AlertTitle>
              <AlertDescription>
                For privacy, this message is the same for every valid sign-up
                request.
              </AlertDescription>
            </Alert>
            <Button
              render={
                <Link
                  to="/login"
                  search={{ redirect: safeRedirect(redirectPath) }}
                />
              }
              nativeButton={false}
              className="w-full"
            >
              Return to sign in
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Create your account</CardTitle>
            <CardDescription>
              Start with a private project and an empty board.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form method="post" onSubmit={submitHandler(form)}>
              <FieldGroup>
                <form.AppField name="name">
                  {(field) => (
                    <field.TextField
                      id="name"
                      label="Name"
                      autoComplete="name"
                      required
                      maxLength={80}
                    />
                  )}
                </form.AppField>
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
                <form.AppField name="password">
                  {(field) => (
                    <field.TextField
                      id="password"
                      label="Password"
                      description="At least 8 characters."
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
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
                      required
                      minLength={8}
                    />
                  )}
                </form.AppField>
                <TurnstileField captcha={captcha} />
                {error && <FieldError>{error}</FieldError>}
                <Field>
                  <form.AppForm>
                    <form.SubmitButton
                      className="w-full"
                      pendingLabel="Creating account…"
                    >
                      Create account
                    </form.SubmitButton>
                  </form.AppForm>
                  <FieldDescription className="text-center">
                    Already have an account?{" "}
                    <Link to={authHref("/login", redirectPath)}>Sign in</Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      )}
    </AuthShell>
  )
}
