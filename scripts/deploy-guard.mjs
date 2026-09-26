import { spawnSync } from "node:child_process"

export const productionBranch = "main"

/**
 * The newer `main` commit that supersedes this build, or null to deploy.
 *
 * Workers Builds runs overlapping builds side by side, so when two merges
 * land close together the older build can finish last and deploy stale code.
 * Only builds of `main` on Workers Builds are checked; manual recovery deploys
 * and missing information always deploy.
 */
export function supersedingCommit({ ci, branch, commit, tip }) {
  if (ci !== "1" || branch !== productionBranch) return null
  if (!commit || !tip) return null
  return tip === commit ? null : tip
}

/** The current tip of `main` on the remote, or null when it cannot be read. */
export function remoteTip(run = spawnSync) {
  const result = run(
    "git",
    ["ls-remote", "origin", `refs/heads/${productionBranch}`],
    { encoding: "utf8" }
  )
  const sha = result.status === 0 ? result.stdout.trim().split(/\s+/)[0] : ""
  return /^[0-9a-f]{40}$/.test(sha) ? sha : null
}
