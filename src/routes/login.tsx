import { createFileRoute } from "@tanstack/react-router"

interface LoginSearch {
  redirect?: string
}

export const Route = createFileRoute("/login")({
  validateSearch: (search): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPlaceholder,
})

function LoginPlaceholder() {
  return (
    <main className="container mx-auto p-4 pt-16">
      <h1>Sign in</h1>
      <p>The authentication UI is the next feature slice.</p>
    </main>
  )
}
