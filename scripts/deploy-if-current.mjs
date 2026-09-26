import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { remoteTip, supersedingCommit } from "./deploy-guard.mjs"

// The last steps of `pnpm cf:deploy:production`: `wrangler deploy`, then the
// post-deploy smoke. A Workers Build whose commit is no longer the tip of
// `main` stops here instead, because the newer commit's own build deploys it.
const { WORKERS_CI, WORKERS_CI_BRANCH, WORKERS_CI_COMMIT_SHA } = process.env

const tip = WORKERS_CI === "1" ? remoteTip() : null
if (WORKERS_CI === "1" && !tip) {
  console.warn("Could not read the tip of main; deploying anyway.")
}

const newer = supersedingCommit({
  ci: WORKERS_CI,
  branch: WORKERS_CI_BRANCH,
  commit: WORKERS_CI_COMMIT_SHA,
  tip,
})
if (newer) {
  console.log(
    `Skipping deploy: main is at ${newer.slice(0, 7)}, newer than this build's ${WORKERS_CI_COMMIT_SHA?.slice(0, 7)}. Its build deploys it.`
  )
  process.exit(0)
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run("wrangler", ["deploy"])
run(process.execPath, [
  join(dirname(fileURLToPath(import.meta.url)), "smoke-after-deploy.mjs"),
])
