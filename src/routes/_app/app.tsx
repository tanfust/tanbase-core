import { createFileRoute, stripSearchParams } from "@tanstack/react-router"
import { CircleAlertIcon, RotateCcwIcon } from "lucide-react"

import { siteConfig } from "@/lib/site"
import { BoardPage } from "@/components/board/board-page"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { seo } from "@/modules/seo/head"
import {
  boardSearchDefaults,
  boardSearchSchema,
} from "@/modules/tasks/board-search"
import type { BoardSearch } from "@/modules/tasks/board-search"
import { boardQueryOptions } from "@/modules/tasks/queries"

export const Route = createFileRoute("/_app/app")({
  // The view and the list's search, filters, sort, and columns live in the
  // URL, so a link opens the same view. Only the project reloads data.
  validateSearch: boardSearchSchema,
  search: { middlewares: [stripSearchParams(boardSearchDefaults)] },
  loaderDeps: ({ search }) => ({ projectId: search.project }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(boardQueryOptions(deps.projectId)),
  head: () =>
    seo({
      title: "Board",
      description: `Your ${siteConfig.name} task board.`,
      noindex: true,
    }),
  pendingComponent: BoardPending,
  errorComponent: BoardError,
  component: AppHome,
})

function AppHome() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  function changeSearch(patch: Partial<BoardSearch>) {
    void navigate({
      search: (previous) => ({ ...previous, ...patch }),
      // Switching views adds a history entry; refining a list replaces it.
      replace: !("view" in patch),
      resetScroll: false,
    })
  }

  return <BoardPage search={search} onSearchChange={changeSearch} />
}

function BoardPending() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading board">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, column) => (
          <div
            className="flex min-h-72 flex-col gap-3 rounded-3xl border bg-muted/30 p-3"
            key={column}
          >
            <Skeleton className="h-6 w-24" />
            {Array.from({ length: 2 }, (__, card) => (
              <Skeleton className="h-28 w-full" key={card} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function BoardError({ reset }: { reset: () => void }) {
  return (
    <Alert variant="destructive" className="max-w-2xl">
      <CircleAlertIcon />
      <AlertTitle>The board could not be loaded</AlertTitle>
      <AlertDescription>
        The project may no longer exist, or the request failed. Choose another
        project from the sidebar or try again.
      </AlertDescription>
      <div className="col-start-2 mt-3">
        <Button type="button" variant="outline" size="sm" onClick={reset}>
          <RotateCcwIcon data-icon="inline-start" />
          Try again
        </Button>
      </div>
    </Alert>
  )
}
