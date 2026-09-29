import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { deployResources } from "./deploy-resources.mjs"
import {
  formatReport,
  optionalItems,
  requiredItems,
  servingVersion,
  settingOrigin,
  wranglerFailure,
} from "./setup-status-core.mjs"

// `pnpm run setup:status [-- --name <worker>]` says what a deployed copy
// has on and off, from the version its Worker serves. It changes nothing.
// The Worker defaults to the top-level name in wrangler.jsonc; a copy
// deployed from the button or the dashboard may have another.

// The Worker is named on the command line, so no environment applies.
delete process.env.CLOUDFLARE_ENV

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2).filter((arg) => arg !== "--")
const nameFlag = args.indexOf("--name")
const worker =
  (nameFlag >= 0 ? args[nameFlag + 1] : null) ??
  deployResources(readFileSync(join(root, "wrangler.jsonc"), "utf8")).name

function stop(message) {
  console.error(`Setup status: ${message}`)
  process.exit(1)
}

function wrangler(command) {
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", ...command, "--name", worker, "--json"],
    { encoding: "utf8" }
  )
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
  if (result.status !== 0) {
    stop(wranglerFailure(output, worker) ?? output.trim())
  }
  return result.stdout ?? ""
}

if (!worker) stop("wrangler.jsonc has no name. Pass --name <worker>.")

const versionId = servingVersion(wrangler(["deployments", "status"]))
if (!versionId) stop(`the Worker "${worker}" has no deployed version.`)

let version
try {
  version = JSON.parse(wrangler(["versions", "view", versionId]))
} catch {
  stop(`could not read version ${versionId}.`)
}

// A pinned origin that does not serve this Worker yet is where sign-in
// breaks, so it is checked, once and briefly.
const pinned = settingOrigin(
  version.resources?.bindings?.find(
    (binding) => binding.name === "BETTER_AUTH_URL"
  )?.text
).origin
let originServes = null
if (pinned) {
  try {
    const response = await fetch(`${pinned}/api/health`, {
      signal: AbortSignal.timeout(8_000),
    })
    const health = await response.json()
    originServes = health?.version === versionId
  } catch {
    originServes = false
  }
}

console.log(
  formatReport({
    worker,
    versionId,
    required: requiredItems(version),
    optional: optionalItems(version, { originServes }),
  })
)
