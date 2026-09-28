import { createServerFn } from "@tanstack/react-start"

import { blogPostInputSchema } from "./schemas"

/** The blog index: every post's summary, newest first, and its head tags. */
export const getBlogIndex = createServerFn({ method: "GET" }).handler(
  async () => {
    const { blogIndexPage } = await import("./pages.server")
    return blogIndexPage()
  }
)

/** One post, rendered, with its head tags; null when no post has the slug. */
export const getBlogPost = createServerFn({ method: "GET" })
  .validator(blogPostInputSchema)
  .handler(async ({ data }) => {
    const { blogPostPage } = await import("./pages.server")
    return blogPostPage(data.slug)
  })
