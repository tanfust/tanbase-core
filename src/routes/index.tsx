import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: App })

function App() {
  return (
    <main className="flex min-h-svh items-center p-6 sm:p-12">
      <section className="flex max-w-2xl min-w-0 flex-col gap-5">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Open-source application foundation
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          TanBase Core
        </h1>
        <p className="max-w-xl text-lg leading-8 text-muted-foreground">
          TanStack Start server rendering and static assets are ready for the
          Cloudflare Workers runtime.
        </p>
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-medium">Cloudflare foundation ready</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            This first slice proves the Worker, environment selection,
            observability, health checks, and deployment flow. D1 is the next
            vertical slice.
          </p>
        </div>
      </section>
    </main>
  )
}
