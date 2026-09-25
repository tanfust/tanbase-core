import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath } from "node:url"

// Runs the production smoke suite against the canonical origin after
// `wrangler deploy`. Some Cloudflare locations keep serving the previous
// version for a minute or more, so smoke first waits until `/api/health`
// reports a version from the new deployment; the old version would otherwise
// pass or fail for the wrong reason. Other failures are retried before the
// deploy command is reported as failed. A failed smoke does not roll back the
// deployment; follow the rollback runbook.
const smokeScript = join(dirname(fileURLToPath(import.meta.url)), "smoke.mjs")
const attempts = 3
const retryDelayMs = 15_000
const propagationTimeoutMs = 180_000
const propagationPollMs = 5_000
// smoke.mjs exits with this status while the edge serves another version.
const notYetServedStatus = 3

function fail(message) {
  console.error(message)
  console.error(
    "Production smoke failed after deployment. Roll back the Worker version before repairing."
  )
  process.exit(1)
}

// Resolves the configuration the same way `wrangler deploy` just did.
function deployedVersions() {
  const result = spawnSync("wrangler", ["deployments", "status", "--json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  })
  try {
    const versions = JSON.parse(result.stdout).versions.map(
      (version) => version.version_id
    )
    if (versions.length > 0) return versions
  } catch {
    // Reported below with Wrangler's own output.
  }
  return fail(
    `Could not read the current deployment from Wrangler.\n${result.stderr || result.stdout || result.error?.message}`
  )
}

const versions = deployedVersions()
const propagationDeadline = Date.now() + propagationTimeoutMs
let failures = 0

for (;;) {
  const result = spawnSync(
    process.execPath,
    [
      smokeScript,
      "--environment",
      "production",
      "--expect-version",
      versions.join(","),
    ],
    { stdio: "inherit" }
  )

  if (result.status === 0) process.exit(0)

  if (result.status === notYetServedStatus) {
    if (Date.now() >= propagationDeadline) {
      fail(
        `The edge did not serve version ${versions.join(" or ")} within ${propagationTimeoutMs / 1000} seconds.`
      )
    }
    await sleep(propagationPollMs)
    continue
  }

  failures += 1
  if (failures >= attempts) fail(`Production smoke failed ${attempts} times.`)
  console.error(
    `Production smoke attempt ${failures} of ${attempts} failed; retrying in ${retryDelayMs / 1000} seconds.`
  )
  await sleep(retryDelayMs)
}
