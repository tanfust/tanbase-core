import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"

import { AuthShell } from "@/components/auth/auth-shell"
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

export const Route = createFileRoute("/forgot-password")({
  validateSearch: (search): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const { redirect } = Route.useSearch()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get("email") ?? "")
    setPending(true)
    setError(null)
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    })
    setPending(false)
    if (result.error)
      setError(result.error.message ?? "Unable to request a reset")
    else setSuccess(true)
  }

  return (
    <AuthShell>
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
            <form method="post" onSubmit={submit}>
              <FieldGroup>
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
                {error && <FieldError>{error}</FieldError>}
                <Field>
                  <Button type="submit" disabled={pending} className="w-full">
                    {pending && <Spinner data-icon="inline-start" />}
                    {pending ? "Requesting reset…" : "Send reset link"}
                  </Button>
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
