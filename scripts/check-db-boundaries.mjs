import { readdirSync, readFileSync } from "node:fs"
import { extname, join, relative, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const sourceRoot = join(root, "src")
const violations = []

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : []
  })
}

for (const file of sourceFiles(sourceRoot)) {
  const display = relative(root, file)
  const allowed =
    display.startsWith("src/db/") ||
    /^src\/modules\/[^/]+\/repository\.server\.ts$/.test(display)

  if (allowed) continue

  const source = readFileSync(file, "utf8")
  if (
    /import\s*{[^}]*\bgetDb\b[^}]*}\s*from\s*["'](?:@\/db|[^"']*\/db(?:\/index)?)["']/.test(
      source
    )
  ) {
    violations.push(display)
  }
}

if (violations.length > 0) {
  console.error(
    `getDb() may only be imported by server repositories:\n- ${violations.join("\n- ")}`
  )
  process.exit(1)
}

console.log("Database access is confined to server repositories.")
