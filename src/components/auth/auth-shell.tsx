import { Link } from "@tanstack/react-router"

import { BrandLockup } from "@/components/brand-lockup"

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh bg-muted/40 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.75fr)]">
      <section className="hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <Link to="/" aria-label="TanBase Core home">
          <BrandLockup className="[&_span]:text-primary-foreground" />
        </Link>
        <div className="flex max-w-lg flex-col gap-5">
          <p className="text-sm font-medium tracking-wide uppercase opacity-80">
            Own the whole stack
          </p>
          <h1 className="text-5xl font-semibold tracking-tight text-balance">
            Your tasks, sessions, and data on one Worker.
          </h1>
          <p className="text-lg leading-8 opacity-80">
            A focused task board built with TanStack Start, Better Auth, D1, and
            Cloudflare Workers.
          </p>
        </div>
        <p className="text-sm opacity-70">
          Open source. Deployable. Deletable.
        </p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="flex w-full max-w-md flex-col gap-8">
          <Link to="/" className="self-center lg:hidden" aria-label="Home">
            <BrandLockup />
          </Link>
          {children}
        </div>
      </section>
    </main>
  )
}
