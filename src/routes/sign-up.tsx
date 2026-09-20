import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { MailCheckIcon } from "lucide-react"

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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/modules/auth/client"
import { authHref, safeRedirect } from "@/modules/auth/redirects"

interface SignUpSearch {
  redirect?: string
}

export const Route = createFileRoute("/sign-up")({
  validateSearch: (search): SignUpSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: SignUpPage,
})

function SignUpPage() {
  const { redirect } = Route.useSearch()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") ?? "")
    const confirmation = String(form.get("confirmation") ?? "")
    if (password !== confirmation) {
      setError("Passwords do not match.")
      return
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.")
      return
    }

    setPending(true)
    setError(null)
    const redirectTarget = safeRedirect(redirect)
    const result = await authClient.signUp.email({
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password,
      callbackURL: `/login?verified=true&redirect=${encodeURIComponent(redirectTarget)}`,
    })
    setPending(false)
    if (result.error) {
      setError(result.error.message ?? "Unable to create the account")
      return
    }
    setSubmitted(true)
  }

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
                  search={{ redirect: safeRedirect(redirect) }}
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
            <form method="post" onSubmit={submit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={80}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                  <FieldDescription>At least 8 characters.</FieldDescription>
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
                    required
                    minLength={8}
                  />
                </Field>
                {error && <FieldError>{error}</FieldError>}
                <Field>
                  <Button type="submit" disabled={pending} className="w-full">
                    {pending && <Spinner data-icon="inline-start" />}
                    {pending ? "Creating account…" : "Create account"}
                  </Button>
                  <FieldDescription className="text-center">
                    Already have an account?{" "}
                    <Link to={authHref("/login", redirect)}>Sign in</Link>
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
