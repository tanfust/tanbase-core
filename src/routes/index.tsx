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
import { homepage } from "@/modules/seo/homepage"

const featureIcons = {
  worker: CloudIcon,
  database: DatabaseIcon,
  auth: KeyRoundIcon,
  board: LayoutDashboardIcon,
} as const

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
              render={<Link to={homepage.signIn.path} />}
              nativeButton={false}
            >
              {homepage.signIn.label}
            </Button>
            <Button
              render={<Link to={homepage.getStarted.path} />}
              nativeButton={false}
            >
              {homepage.getStarted.label}
            </Button>
          </div>
        </nav>
      </header>
      <main>
        <section className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-24 text-center sm:py-32">
          <p className="rounded-full bg-muted px-4 py-1.5 text-sm font-medium text-muted-foreground">
            {homepage.eyebrow}
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-balance sm:text-7xl">
            {homepage.title}
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            {homepage.summary}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              render={<Link to={homepage.primaryAction.path} />}
              nativeButton={false}
            >
              {homepage.primaryAction.label}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              render={<Link to={homepage.secondaryAction.path} />}
              nativeButton={false}
            >
              {homepage.secondaryAction.label}
            </Button>
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-2 lg:grid-cols-4">
          {homepage.features.map(({ key, title, description }) => {
            const FeatureIcon = featureIcons[key]
            return (
              <Card key={key} size="sm">
                <CardHeader>
                  <FeatureIcon />
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </section>
      </main>
    </div>
  )
}
