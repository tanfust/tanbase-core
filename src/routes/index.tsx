import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"

import { BrandLockup } from "@/components/brand-lockup"
import { AllowanceTable, CostLists } from "@/components/landing/cost-model"
import { DeployPanel } from "@/components/landing/deploy-panel"
import { GitHubMark } from "@/components/landing/github-mark"
import { PrimitiveMap } from "@/components/landing/primitive-map"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { siteConfig } from "@/lib/site"
import { getSiteOrigin } from "@/modules/seo/functions"
import { seo, softwareSourceCode } from "@/modules/seo/head"
import { homepage } from "@/modules/seo/homepage"

export const Route = createFileRoute("/")({
  // The origin changes only with configuration, so load it once per visit.
  loader: () => getSiteOrigin(),
  staleTime: Number.POSITIVE_INFINITY,
  head: ({ loaderData }) => {
    const origin = loaderData?.origin ?? siteConfig.origin
    return seo({
      path: "/",
      origin,
      structuredData: softwareSourceCode(origin),
    })
  },
  component: App,
})

const sectionHeading =
  "text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
const sectionIntro =
  "max-w-xl text-lg leading-8 text-pretty text-muted-foreground"

function App() {
  const { primitives, cost, footer } = homepage

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* The visible lockup text names the link. */}
          <Link to="/" className="rounded-2xl">
            <BrandLockup />
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              to={homepage.signIn.path}
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              {homepage.signIn.label}
            </Link>
            <a
              href={homepage.source.href}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <GitHubMark data-icon="inline-start" />
              GitHub
            </a>
          </div>
        </nav>
      </header>
      <main>
        <section className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 pt-20 pb-20 text-center sm:pt-32 sm:pb-28">
          <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-balance sm:text-7xl">
            {homepage.title}
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-pretty text-muted-foreground">
            {homepage.summary}
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <a
              href={homepage.source.href}
              className={cn(buttonVariants({ size: "lg" }))}
            >
              <GitHubMark data-icon="inline-start" />
              {homepage.source.label}
            </a>
            <Link
              to={homepage.demo.path}
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
            >
              {homepage.demo.label}
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </div>
        </section>

        <section aria-labelledby="primitives-heading" className="border-t">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div className="flex flex-col gap-4 lg:sticky lg:top-12 lg:self-start">
              <h2 id="primitives-heading" className={sectionHeading}>
                {primitives.heading}
              </h2>
              <p className={sectionIntro}>{primitives.intro}</p>
            </div>
            <PrimitiveMap />
          </div>
        </section>

        <section aria-labelledby="cost-heading" className="border-t">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div className="flex flex-col gap-4">
              <h2 id="cost-heading" className={sectionHeading}>
                {cost.heading}
              </h2>
              <p className={sectionIntro}>{cost.intro}</p>
            </div>
            <div className="flex flex-col gap-12">
              <AllowanceTable />
              <CostLists />
            </div>
          </div>
        </section>

        <DeployPanel />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Open source under the{" "}
            <a
              href={footer.license.href}
              className="rounded-sm text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              {footer.license.label}
            </a>
            .
          </p>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {footer.links.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  )
}
