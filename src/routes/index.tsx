import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowRightIcon,
  CloudIcon,
  DatabaseIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
} from "lucide-react"

import { BrandLockup } from "@/components/brand-lockup"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute("/")({ component: App })

function App() {
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" aria-label="TanBase Core home">
            <BrandLockup />
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              render={<Link to="/login" />}
              nativeButton={false}
            >
              Sign in
            </Button>
            <Button render={<Link to="/sign-up" />} nativeButton={false}>
              Get started
            </Button>
          </div>
        </nav>
      </header>
      <main>
        <section className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-24 text-center sm:py-32">
          <p className="rounded-full bg-muted px-4 py-1.5 text-sm font-medium text-muted-foreground">
            TanStack Start on Cloudflare Workers
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-balance sm:text-7xl">
            A task board that proves the whole stack works.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Server rendering, sessions, relational data, and a responsive app
            shell—running together in one open-source Worker.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              render={<Link to="/sign-up" />}
              nativeButton={false}
            >
              Create your board
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              render={<Link to="/app" />}
              nativeButton={false}
            >
              Open the app
            </Button>
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-2 lg:grid-cols-4">
          {[
            [
              CloudIcon,
              "One Worker",
              "TanStack Start SSR and static assets share one deploy.",
            ],
            [
              DatabaseIcon,
              "D1 ownership",
              "Projects and tasks stay behind user-scoped repositories.",
            ],
            [
              KeyRoundIcon,
              "Better Auth",
              "Verified email, revocable sessions, and password recovery.",
            ],
            [
              LayoutDashboardIcon,
              "Working product",
              "A responsive project board instead of disconnected demos.",
            ],
          ].map(([Icon, title, description]) => {
            const FeatureIcon = Icon as typeof CloudIcon
            return (
              <Card key={title as string} size="sm">
                <CardHeader>
                  <FeatureIcon />
                  <CardTitle>{title as string}</CardTitle>
                  <CardDescription>{description as string}</CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </section>
      </main>
    </div>
  )
}
