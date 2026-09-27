import interWoff2 from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?inline"
import { initSync, Renderer } from "@takumi-rs/wasm"
import type { Node } from "@takumi-rs/wasm"
import takumiModule from "@takumi-rs/wasm/auto"

import { siteConfig } from "@/lib/site"

import { ogImageSize } from "./cards"
import type { OgCardContent } from "./content.server"

// The landing page's light theme tokens from src/styles.css, in sRGB.
const colors = {
  background: "#ffffff",
  foreground: "#0a0a0a",
  muted: "#737373",
  border: "#e5e5e5",
  chip: "#fafafa",
  chipText: "#404040",
  primary: "#1447e6",
  primaryForeground: "#eff6ff",
}

// Lucide's square-check icon, the header's mark when there is no logo.
const fallbackMark = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${colors.primaryForeground}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>`

// The SVGs in public/, bundled as text so the Worker can draw the logo.
const publicSvgs = import.meta.glob<string>("/public/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
})

/** Paints every filled or stroked shape of a one-color SVG in `color`. */
export function tintSvg(svg: string, color: string): string {
  return svg.replace(/\b(fill|stroke)="(?!none")[^"]*"/g, `$1="${color}"`)
}

/**
 * The configured logo as an image source, light on the primary tile like
 * the header's. A logo that is not an SVG in public/ falls back to the icon.
 */
function brandMark(): string {
  const { logo } = siteConfig
  const svg = logo ? publicSvgs[`/public${logo.src}`] : undefined
  const mark =
    !logo || !svg
      ? fallbackMark
      : logo.monochrome
        ? tintSvg(svg, colors.primaryForeground)
        : svg
  return `data:image/svg+xml;utf8,${encodeURIComponent(mark)}`
}

let renderer: Renderer | undefined

function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1)
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

// The WebAssembly module is compiled when the Worker starts; it is
// instantiated, with the font, only when the first image is drawn.
function getRenderer(): Renderer {
  if (renderer) return renderer
  initSync({ module: takumiModule })
  renderer = new Renderer()
  renderer.registerFont({ name: "Inter", data: dataUrlBytes(interWoff2) })
  return renderer
}

function lockup(): Node {
  return {
    type: "container",
    style: { display: "flex", alignItems: "center", gap: 24 },
    children: [
      {
        type: "container",
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 80,
          height: 80,
          borderRadius: 26,
          backgroundColor: colors.primary,
        },
        children: [
          {
            type: "image",
            src: brandMark(),
            width: 64,
            height: 64,
            style: { objectFit: "contain" },
          },
        ],
      },
      {
        type: "container",
        style: { display: "flex", flexDirection: "column", gap: 6 },
        children: [
          {
            type: "text",
            text: siteConfig.name,
            style: { fontSize: 34, fontWeight: 600 },
          },
          {
            type: "text",
            text: siteConfig.subtitle,
            style: { fontSize: 26, color: colors.muted },
          },
        ],
      },
    ],
  }
}

function chip(label: string): Node {
  return {
    type: "text",
    text: label,
    style: {
      padding: "10px 24px",
      borderRadius: 999,
      border: `2px solid ${colors.border}`,
      backgroundColor: colors.chip,
      color: colors.chipText,
      fontSize: 26,
      fontWeight: 500,
    },
  }
}

export function cardNode(card: OgCardContent): Node {
  return {
    type: "container",
    style: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: 80,
      backgroundColor: colors.background,
      backgroundImage:
        "radial-gradient(circle at 100% 0%, rgba(20, 71, 230, 0.14), rgba(20, 71, 230, 0) 60%)",
      color: colors.foreground,
      fontFamily: "Inter",
    },
    children: [
      lockup(),
      {
        type: "text",
        text: card.title,
        style: {
          maxWidth: 1000,
          fontSize: 76,
          fontWeight: 600,
          lineHeight: 1.05,
          letterSpacing: -2,
        },
      },
      {
        type: "container",
        style: { display: "flex", flexWrap: "wrap", gap: 14 },
        children: card.tags.map(chip),
      },
    ],
  }
}

/** Draws a card as a PNG at the Open Graph size. */
export async function renderCard(
  card: OgCardContent
): Promise<Uint8Array<ArrayBuffer>> {
  return getRenderer().render(cardNode(card), { ...ogImageSize, format: "png" })
}
