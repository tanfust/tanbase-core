import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/app")({
  component: AppHome,
})

function AppHome() {
  const { session } = Route.useRouteContext()

  return (
    <main className="container mx-auto p-4 pt-16">
      <h1>App</h1>
      <p>Signed in as {session.user.email}</p>
    </main>
  )
}
