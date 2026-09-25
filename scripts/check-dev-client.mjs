import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"

// Production builds remove dead server-only imports before import protection
// sees them; the Vite dev server does not. This walks the client module graph
// that the dev server serves and fails on any module it cannot transform.
const port = 3199
const origin = `http://localhost:${port}`

const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "dev",
    "--port",
    String(port),
    "--strictPort",
  ],
  { stdio: ["ignore", "pipe", "pipe"] }
)
let serverOutput = ""
server.stdout.on("data", (chunk) => (serverOutput += chunk))
server.stderr.on("data", (chunk) => (serverOutput += chunk))

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${origin}/`)
      if (response.ok) return await response.text()
    } catch {
      // Not listening yet.
    }
    await sleep(500)
  }
  throw new Error(`The dev server did not start:\n${serverOutput}`)
}

function moduleImports(source) {
  const specifiers = new Set()
  const pattern =
    /(?:\bimport\s*(?:[^"'()]*?from\s*)?|\bimport\s*\(\s*|\bexport\s+[^"']*?from\s*)["']([^"']+)["']/g
  for (const match of source.matchAll(pattern)) specifiers.add(match[1])
  return [...specifiers].filter((specifier) => specifier.startsWith("/src/"))
}

try {
  const html = await waitForServer()
  const entries = [
    ...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g),
  ].map((match) => match[1])
  const queue = [...entries, "/src/router.tsx"]
  const visited = new Set()
  const failures = []

  while (queue.length > 0) {
    const url = queue.shift()
    if (visited.has(url)) continue
    visited.add(url)

    const response = await fetch(new URL(url, origin))
    const source = await response.text()
    if (!response.ok || /import-protection/.test(source)) {
      failures.push(`${url}: HTTP ${response.status}\n${source.slice(0, 600)}`)
      continue
    }
    for (const specifier of moduleImports(source)) queue.push(specifier)
  }

  if (failures.length > 0) {
    console.error(
      `Dev client modules failed to load:\n\n${failures.join("\n\n")}`
    )
    process.exitCode = 1
  } else {
    console.log(`Dev client graph loaded (${visited.size} modules checked).`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  server.kill("SIGTERM")
}
