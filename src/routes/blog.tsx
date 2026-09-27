import { createFileRoute, Link, Outlet } from "@tanstack/react-router"
import { RssIcon } from "lucide-react"

import { BrandLockup } from "@/components/brand-lockup"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { blogCopy, blogFeedPath } from "@/modules/blog/contracts"

export const Route = createFileRoute("/blog")({
  component: BlogLayout,
})

function BlogLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b">
        <nav
          aria-label="Site"
          className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
        >
          {/* The visible lockup text names the link. */}
          <Link to="/" className="rounded-2xl">
            <BrandLockup />
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/blog"
              className={cn(buttonVariants({ variant: "ghost" }))}
              activeOptions={{ exact: true }}
            >
              {blogCopy.title}
            </Link>
            <Link
              to="/login"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Sign in
            </Link>
          </div>
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6">
          <p>{blogCopy.feedTitle}</p>
          <a
            href={blogFeedPath}
            className="inline-flex items-center gap-1.5 rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <RssIcon aria-hidden="true" className="size-4" />
            RSS feed
          </a>
        </div>
      </footer>
    </div>
  )
}
