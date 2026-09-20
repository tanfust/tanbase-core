import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { CheckCircle2Icon } from "lucide-react"

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
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [resending, setResending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await authClient.signIn.email({ email, password })
    setPending(false)
    if (result.error) {
      setError(result.error.message ?? "Unable to sign in")
      return
    }
    await navigate({ to: safeRedirect(search.redirect) })
  }

  async function resendVerification() {
    if (!email) {
      setError("Enter your email first, then resend the verification message.")
      return
    }
    setResending(true)
    const callbackURL = authHref("/login?verified=true", search.redirect)
    const result = await authClient.sendVerificationEmail({
      email,
      callbackURL,
    })
    setResending(false)
    setError(
      result.error
        ? (result.error.message ?? "Unable to resend verification")
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
          <CardDescription>Sign in with your verified email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="post" onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field>
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Link
                    to="/forgot-password"
                    search={{ redirect: search.redirect }}
                    className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              {error && <FieldError>{error}</FieldError>}
              <Field>
                <Button type="submit" disabled={pending} className="w-full">
                  {pending && <Spinner data-icon="inline-start" />}
                  {pending ? "Signing in…" : "Sign in"}
                </Button>
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
                  New to TanBase?{" "}
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
