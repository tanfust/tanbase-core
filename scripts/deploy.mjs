import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { isUpstreamRemote, originUrl } from "./deploy-guard.mjs"
import { deployResources, prepareResources } from "./deploy-resources.mjs"

// `pnpm run deploy`: creates the D1 database and the R2 bucket when they are
// missing, applies D1 migrations, then deploys the top-level Wrangler
// configuration. The Deploy to Cloudflare button runs it after
// `pnpm run build`, and a repository imported from the dashboard needs it as
// its deploy command. TanBase's own production deploys with
// `pnpm cf:deploy:production` instead.
if (isUpstreamRemote(originUrl())) {
  console.error(
    "Refusing to deploy: this is the upstream TanBase checkout, where the " +
      "top-level configuration would replace the demo's production Worker. " +
      "Production deploys from Workers Builds with `pnpm cf:deploy:production`. " +
      "Deploying to your own account? Push this checkout to your own " +
      "repository first, or use `pnpm run setup`."
  )
  process.exit(1)
}

function run(args) {
  const result = spawnSync("pnpm", ["exec", "wrangler", ...args], {
    stdio: "inherit",
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function capture(args) {
  const result = spawnSync("pnpm", ["exec", "wrangler", ...args], {
    encoding: "utf8",
  })
  const stdout = result.stdout ?? ""
  return {
    status: result.status ?? 1,
    stdout,
    output: `${stdout}\n${result.stderr ?? ""}`.trim(),
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
try {
  prepareResources(
    deployResources(readFileSync(join(root, "wrangler.jsonc"), "utf8")),
    capture,
    (line) => console.log(line)
  )
} catch (error) {
  console.error(
    `\nDeploy stopped: ${error instanceof Error ? error.message : String(error)}`
  )
  process.exit(1)
}

run(["d1", "migrations", "apply", "DB", "--remote"])
run(["deploy"])
