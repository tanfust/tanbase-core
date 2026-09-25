import { Link, useRouter } from "@tanstack/react-router"
import type { ErrorComponentProps } from "@tanstack/react-router"
import { CompassIcon, TriangleAlertIcon } from "lucide-react"

import { BrandLockup } from "@/components/brand-lockup"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

function StatusShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col bg-muted/40">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-6">
        <Link to="/" aria-label="TanBase Core home">
          <BrandLockup />
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center p-6">
        {children}
      </div>
    </main>
  )
}

export function NotFoundPage() {
  return (
    <StatusShell>
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CompassIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>
            The page you are looking for does not exist or has moved.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link to="/" />} nativeButton={false}>
            Go to the homepage
          </Button>
        </EmptyContent>
      </Empty>
    </StatusShell>
  )
}

export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()

  return (
    <StatusShell>
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Something went wrong</EmptyTitle>
          <EmptyDescription>
            An unexpected error stopped this page from loading. Try again, or
            return to the homepage.
          </EmptyDescription>
          {import.meta.env.DEV && (
            <pre className="mt-2 max-w-full overflow-x-auto rounded-md bg-muted p-3 text-left text-xs">
              {error instanceof Error ? error.message : String(error)}
            </pre>
          )}
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button
            onClick={() => {
              reset()
              void router.invalidate()
            }}
          >
            Try again
          </Button>
          <Button
            variant="outline"
            render={<Link to="/" />}
            nativeButton={false}
          >
            Go to the homepage
          </Button>
        </EmptyContent>
      </Empty>
    </StatusShell>
  )
}
