import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CircleAlertIcon, ShieldCheckIcon } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/modules/auth/client"
import { oauthContinuation } from "@/modules/auth/redirects"

interface ConsentSearch {
  client_id?: string
  scope?: string
  redirect_uri?: string
}

interface PublicClient {
  client_name?: string
  client_uri?: string
}

const scopeDescriptions: Record<string, string> = {
  openid: "Confirm who you are",
  profile: "See your name",
  email: "See your email address",
  offline_access: "Stay connected without asking you again",
}

function hostOf(value?: string) {
  try {
    return value ? new URL(value).host : null
  } catch {
    return null
  }
}

// The OAuth provider sends signed-in users here to approve an MCP client.
// The signed query stays in the address bar: the auth client forwards it with
// the consent request.
export const Route = createFileRoute("/oauth/consent")({
  validateSearch: (search): ConsentSearch => ({
    client_id:
      typeof search.client_id === "string" ? search.client_id : undefined,
    scope: typeof search.scope === "string" ? search.scope : undefined,
    redirect_uri:
      typeof search.redirect_uri === "string" ? search.redirect_uri : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Allow access · TanBase Core" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConsentPage,
})

function ConsentPage() {
  const search = Route.useSearch()
  const [pending, setPending] = useState<"allow" | "deny" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const client = useQuery({
    queryKey: ["oauth", "client", search.client_id],
    enabled: Boolean(search.client_id),
    queryFn: async () => {
      const { data, error: fetchError } = await authClient.$fetch<PublicClient>(
        "/oauth2/public-client",
        { method: "GET", query: { client_id: search.client_id } }
      )
      if (fetchError) throw new Error("This app is not registered.")
      return data
    },
  })

  const name = client.data?.client_name ?? "An app"
  const returnHost = hostOf(search.redirect_uri)
  const scopes = (search.scope ?? "").split(" ").filter(Boolean)

  async function decide(accept: boolean) {
    setPending(accept ? "allow" : "deny")
    setError(null)
    const { data, error: consentError } = await authClient.$fetch(
      "/oauth2/consent",
      { method: "POST", body: { accept } }
    )
    const next = consentError ? null : oauthContinuation(data)
    if (!next) {
      setPending(null)
      setError("The request expired. Start connecting again from the app.")
      return
    }
    window.location.assign(next)
  }

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShieldCheckIcon aria-hidden="true" className="size-5" />
            Allow {name} to use your tasks?
          </CardTitle>
          <CardDescription>
            {name} will be able to list your tasks, create tasks, and mark them
            done in TanBase Core, acting as you.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!search.client_id || client.isError ? (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden="true" />
              <AlertTitle>This request is not valid</AlertTitle>
              <AlertDescription>
                Start connecting again from the app that sent you here.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {scopes.length > 0 && (
                <ul className="flex list-disc flex-col gap-1 ps-5 text-sm">
                  {scopes.map((scope) => (
                    <li key={scope}>{scopeDescriptions[scope] ?? scope}</li>
                  ))}
                </ul>
              )}
              {returnHost && (
                <p className="text-sm text-muted-foreground">
                  After you decide, you will return to{" "}
                  <span className="font-medium text-foreground">
                    {returnHost}
                  </span>
                  . Only allow apps you trust.
                </p>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={pending !== null || !search.client_id}
            onClick={() => decide(false)}
          >
            {pending === "deny" && <Spinner data-icon="inline-start" />}
            Deny
          </Button>
          <Button
            disabled={pending !== null || !search.client_id || client.isPending}
            onClick={() => decide(true)}
          >
            {pending === "allow" && <Spinner data-icon="inline-start" />}
            Allow
          </Button>
        </CardFooter>
      </Card>
    </AuthShell>
  )
}
