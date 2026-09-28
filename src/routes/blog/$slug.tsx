import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { formatPostDate } from "@/modules/blog/contracts"
import { getBlogPost } from "@/modules/blog/functions"
import { seo } from "@/modules/seo/head"

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const page = await getBlogPost({ data: { slug: params.slug } })
    if (!page) throw notFound()
    return page
  },
  // Posts change only with a deploy.
  staleTime: Number.POSITIVE_INFINITY,
  // The Worker builds the head tags; see src/modules/blog/pages.server.ts.
  head: ({ loaderData }) =>
    loaderData?.head ?? seo({ title: "Post not found", noindex: true }),
  component: PostPage,
})

function PostPage() {
  const { post } = Route.useLoaderData()

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-4">
        <Link
          to="/blog"
          className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          All posts
        </Link>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {post.title}
        </h1>
        <p className="text-lg leading-8 text-pretty text-muted-foreground">
          {post.description}
        </p>
        <p className="text-sm text-muted-foreground">
          By {post.author} ·{" "}
          <time dateTime={post.date}>{formatPostDate(post.date)}</time> ·{" "}
          {post.readingMinutes} min read
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Tags">
          {post.tags.map((tag) => (
            <li key={tag}>
              <Badge variant="secondary">{tag}</Badge>
            </li>
          ))}
        </ul>
      </header>
      {/* TanStack Markdown rendered this on the Worker from a post in the
          repository, with raw HTML off; the browser loads no Markdown code. */}
      <div
        className="blog-prose"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />
    </article>
  )
}
