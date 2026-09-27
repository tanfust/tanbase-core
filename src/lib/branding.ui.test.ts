import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

// Runs in the jsdom suite, which has Node's file system. Vitest runs from the
// repository root.
const root = process.cwd()
const source = join(root, "src")

// The template's own name. Every page, email, and document reads the name
// from src/lib/site.ts, so a fork renames the app in that one file.
const templateName = /tanbase/i

const skipped = new Set([
  "src/lib/site.ts",
  "src/routeTree.gen.ts",
  "src/worker-configuration.d.ts",
])

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? files(path) : [path]
  })
}

describe("branding", () => {
  it("names the app only in src/lib/site.ts", () => {
    const offenders = files(source)
      .map((path) => relative(root, path))
      .filter(
        (path) =>
          !skipped.has(path) &&
          !/\.test\.[cm]?[jt]sx?$|\.snap$/.test(path) &&
          /\.(css|json|md|mdx|[cm]?[jt]sx?|txt)$/.test(path)
      )
      .filter((path) =>
        templateName.test(readFileSync(join(root, path), "utf8"))
      )

    expect(offenders).toEqual([])
  })
})
