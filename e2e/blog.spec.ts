import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

const slug = "why-tanbase-core"

async function waitForHydration(page: Page) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll("body *")].some((element) =>
      Object.keys(element).some((key) => key.startsWith("__reactProps$"))
    )
  )
}

function meta(page: Page, property: string) {
  return page
    .locator(`meta[property="${property}"], meta[name="${property}"]`)
    .getAttribute("content")
}

test("the blog lists posts, renders them on the server, and feeds them", async ({
  page,
  request,
}) => {
  console.log("e2e: blog index")
  await page.goto("/")
  await waitForHydration(page)
  await page
    .getByRole("navigation", { name: "Footer" })
    .getByRole("link", { name: "Blog" })
    .click()
  await expect(page).toHaveURL(/\/blog$/)
  await expect(page.getByRole("heading", { level: 1 })).toContainText("blog")
  const link = page.getByRole("link", { name: "Why TanBase Core" })
  await expect(link).toBeVisible()
  expect(
    await page.locator('link[rel="canonical"]').getAttribute("href")
  ).toMatch(/\/blog$/)

  console.log("e2e: blog post")
  // A client-side navigation loads the post through its server function.
  await waitForHydration(page)
  await link.click()
  await expect(page).toHaveURL(new RegExp(`/blog/${slug}$`))
  await expect(
    page.getByRole("heading", { level: 1, name: "Why TanBase Core" })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { level: 2, name: /Not a bare template/ })
  ).toBeVisible()
  expect(await meta(page, "og:type")).toBe("article")
  expect(await meta(page, "og:image")).toMatch(
    new RegExp(`/og/blog-${slug}\\.png$`)
  )
  expect(await meta(page, "robots")).toBe("index, follow")

  // The Worker sends the rendered post, head tags and JSON-LD included.
  const html = await (await request.get(`/blog/${slug}`)).text()
  expect(html).toContain('<h2 id="not-a-bare-template">')
  expect(html).toContain('"@type":"BlogPosting"')
  expect(html).toMatch(/<link[^>]+rel="alternate"[^>]+application\/rss\+xml/)
  expect(html).not.toContain("<script>alert")

  console.log("e2e: feed, sitemap, and preview image")
  const feed = await request.get("/blog/rss.xml")
  expect(feed.status()).toBe(200)
  expect(feed.headers()["content-type"]).toContain("application/rss+xml")
  expect(await feed.text()).toContain(`/blog/${slug}</link>`)

  const sitemap = await (await request.get("/sitemap.xml")).text()
  expect(sitemap).toContain("/blog</loc>")
  expect(sitemap).toContain(`/blog/${slug}</loc>`)

  const image = await request.get(`/og/blog-${slug}.png`)
  expect(image.status()).toBe(200)
  expect(image.headers()["content-type"]).toBe("image/png")

  await page.screenshot({ path: "output/playwright/blog-post.png" })

  console.log("e2e: missing post")
  const missing = await page.goto("/blog/no-such-post")
  expect(missing?.status()).toBe(404)
  expect(await meta(page, "robots")).toBe("noindex")
})
