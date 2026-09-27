import { exports as workerExports } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import { homepage } from "@/modules/seo/homepage"

import { ogCards, ogImage, ogImagePath } from "./cards"
import { ogCardContent, ogCardForPath } from "./content.server"

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function imageRequest(path: string, init?: RequestInit) {
  return workerExports.OgImage.fetch(
    new Request(`https://example.com${path}`, init)
  )
}

describe("preview image cards", () => {
  it("finds a registered card by its path", () => {
    expect(ogImagePath("home")).toBe("/og/home.png")
    expect(ogCardForPath("/og/home.png")).toBe(ogCardContent.home)
  })

  it("describes each card as pages name it", () => {
    expect(ogImage("home")).toEqual({
      path: "/og/home.png",
      alt: ogCards.home.alt,
      width: 1200,
      height: 630,
    })
  })

  it("keeps the home card's text and alt text on the homepage headline", () => {
    expect(ogCardContent.home.title).toBe(homepage.title)
    expect(ogCards.home.alt).toContain(homepage.title)
  })

  it("rejects other paths, formats, and inherited names", () => {
    for (const path of [
      "/og/missing.png",
      "/og/home.jpg",
      "/og/HOME.png",
      "/og/home.png/extra",
      "/og/constructor.png",
      "/og/__proto__.png",
    ]) {
      expect(ogCardForPath(path), path).toBeNull()
    }
  })
})

describe("the OgImage entrypoint", () => {
  it("draws a 1200 by 630 PNG that caches until the next deploy", async () => {
    const response = await imageRequest("/og/home.png")

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("image/png")
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400")
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "public, max-age=31536000"
    )
    const bytes = new Uint8Array(await response.arrayBuffer())
    expect([...bytes.subarray(0, 8)]).toEqual(pngSignature)
    expect(pngSize(bytes)).toEqual({ width: 1200, height: 630 })
    expect(response.headers.get("Content-Length")).toBe(
      String(bytes.byteLength)
    )
  })

  it("answers HEAD without a body", async () => {
    const response = await imageRequest("/og/home.png", { method: "HEAD" })

    expect(response.status).toBe(200)
    expect(Number(response.headers.get("Content-Length"))).toBeGreaterThan(0)
    expect(await response.text()).toBe("")
  })

  it("does not draw unknown cards", async () => {
    const response = await imageRequest("/og/anything-you-like.png")

    expect(response.status).toBe(404)
    expect(response.headers.get("Content-Type")).not.toBe("image/png")
  })

  it("rejects other methods without caching", async () => {
    const response = await imageRequest("/og/home.png", { method: "POST" })

    expect(response.status).toBe(405)
    expect(response.headers.get("Allow")).toBe("GET, HEAD")
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })
})
