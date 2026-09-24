import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath } from "node:url"

// Runs the production smoke suite against the canonical origin after
// `wrangler deploy`. The edge can briefly serve the previous version, so a
// failure is retried before the deploy command is reported as failed. A failed
// smoke does not roll back the deployment; follow the rollback runbook.
const smokeScript = join(dirname(fileURLToPath(import.meta.url)), "smoke.mjs")
const attempts = 3
const retryDelayMs = 15_000

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const result = spawnSync(
    process.execPath,
    [smokeScript, "--environment", "production"],
    { stdio: "inherit" }
  )

  if (result.status === 0) process.exit(0)

  if (attempt < attempts) {
    console.error(
      `Production smoke attempt ${attempt} of ${attempts} failed; retrying in ${retryDelayMs / 1000} seconds.`
    )
    await sleep(retryDelayMs)
  }
}

console.error(
  "Production smoke failed after deployment. Roll back the Worker version before repairing."
)
process.exit(1)
