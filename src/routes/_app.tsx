import { createFileRoute, redirect } from "@tanstack/react-router"

import { AppShell } from "@/components/app-shell"
import { getSession } from "@/modules/auth/session"
import { getProjects } from "@/modules/tasks/functions"

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const session = await getSession()

    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      })
    }

    const projects = await getProjects()
    return { session, projects }
  },
  component: ProtectedLayout,
})

function ProtectedLayout() {
  const { session, projects } = Route.useRouteContext()

  return (
    <AppShell
      projects={projects}
      user={{ name: session.user.name, email: session.user.email }}
    />
  )
}
