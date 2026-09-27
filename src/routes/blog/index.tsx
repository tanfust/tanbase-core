import { createFileRoute, Link } from "@tanstack/react-router"

import { Badge } from "@/components/ui/badge"
import { blogCopy, formatPostDate } from "@/modules/blog/contracts"
import { getBlogIndex } from "@/modules/blog/functions"

export const Route = createFileRoute("/blog/")({
  loader: () => getBlogIndex(),
  // Posts change only with a deploy.
  staleTime: Number.POSITIVE_INFINITY,
  // The Worker builds the head tags; see src/modules/blog/pages.server.ts.
  head: ({ loaderData }) => loaderData?.head ?? {},
  component: BlogIndex,
})

function BlogIndex() {
  const { posts } = Route.useLoaderData()

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">
          {blogCopy.heading}
        </h1>
        <p className="text-lg leading-8 text-pretty text-muted-foreground">
          {blogCopy.description}
        </p>
      </div>
      {posts.length === 0 ? (
        <p className="text-muted-foreground">No posts yet.</p>
      ) : (
        <ol className="flex flex-col divide-y">
          {posts.map((post) => (
            <li key={post.slug} className="py-6 first:pt-0">
              <article className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  <time dateTime={post.date}>{formatPostDate(post.date)}</time>{" "}
                  · {post.readingMinutes} min read
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  <Link
                    to="/blog/$slug"
                    params={{ slug: post.slug }}
                    className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="leading-7 text-pretty text-muted-foreground">
                  {post.description}
                </p>
                <ul className="flex flex-wrap gap-2" aria-label="Tags">
                  {post.tags.map((tag) => (
                    <li key={tag}>
                      <Badge variant="secondary">{tag}</Badge>
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
