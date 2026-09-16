import { mkdtemp, cp, symlink, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const temporaryRoot = await mkdtemp(join(tmpdir(), "tanbase-boundary-"))
const excluded = new Set([".git", ".wrangler", "dist", "node_modules"])

function run(command, args, cwd) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let output = ""
    child.stdout.on("data", (chunk) => (output += chunk))
    child.stderr.on("data", (chunk) => (output += chunk))
    child.on("error", reject)
    child.on("close", (code) => resolveResult({ code, output }))
  })
}

try {
  await cp(root, temporaryRoot, {
    recursive: true,
    filter: (source) => !excluded.has(source.split("/").at(-1)),
  })
  await symlink(join(root, "node_modules"), join(temporaryRoot, "node_modules"))

  const protectedModule = join(
    temporaryRoot,
    "src",
    "platform",
    "boundary-check.server.ts"
  )
  await writeFile(
    protectedModule,
    'export const serverSecret = "not-for-clients"\n',
    {
      flag: "wx",
    }
  ).catch(async (error) => {
    if (error.code !== "ENOENT") throw error
    const { mkdir } = await import("node:fs/promises")
    await mkdir(dirname(protectedModule), { recursive: true })
    await writeFile(
      protectedModule,
      'export const serverSecret = "not-for-clients"\n'
    )
  })

  const routePath = join(temporaryRoot, "src", "routes", "index.tsx")
  const { readFile } = await import("node:fs/promises")
  const route = await readFile(routePath, "utf8")
  await writeFile(
    routePath,
    `import { serverSecret } from "@/platform/boundary-check.server"\nvoid serverSecret\n${route}`
  )

  const result = await run(
    join(root, "node_modules", ".bin", "vite"),
    ["build"],
    temporaryRoot
  )

  if (
    result.code === 0 ||
    !/import protection|denied by file pattern/i.test(result.output)
  ) {
    console.error(result.output)
    throw new Error(
      "A forbidden client import did not fail with import protection"
    )
  }

  console.log(
    "Import protection rejected a deliberate server-only client import."
  )
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
