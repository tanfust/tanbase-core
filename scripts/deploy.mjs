import { spawnSync } from "node:child_process"

import { isUpstreamRemote, originUrl } from "./deploy-guard.mjs"

// `pnpm run deploy`: applies D1 migrations, then deploys the top-level
// Wrangler configuration. The Deploy to Cloudflare button runs it after
// `pnpm run build`. TanBase's own production deploys with
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

run(["d1", "migrations", "apply", "DB", "--remote"])
run(["deploy"])
