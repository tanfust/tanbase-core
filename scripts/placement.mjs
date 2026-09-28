#!/usr/bin/env node

import { readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  parsePlacementArguments,
  placementRegionFor,
  placementValue,
  readPlacementTarget,
  updatePlacement,
} from "./setup/core.mjs"
import { packageManager, readD1Location } from "./setup/runner.mjs"

// `pnpm run placement`: finds where the DB database's primary is and
// recommends the placement hint that runs the Worker next to it
// (ADR-0011). For installs the guided installer did not make, such as the
// Deploy to Cloudflare button's, which deploys the top level.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const configPath = join(root, "wrangler.jsonc")

function help() {
  process.stdout.write(`TanBase placement

Usage:
  pnpm run placement [options]

Reads where the DB database's primary is with one read-only query, and
prints the placement hint that runs the Worker next to it.

Options:
  --env <name>        Use env.<name> of wrangler.jsonc, such as production;
                      without it, the top level, which the Deploy to
                      Cloudflare button deploys
  --write             Write the hint into that section of wrangler.jsonc
  --account-id <id>   Select a Cloudflare account when the login has several
  --help, -h          Show this help
`)
}

async function main() {
  const options = parsePlacementArguments(process.argv.slice(2))
  if (options.help) {
    help()
    return
  }

  const section = options.environment
    ? `env.${options.environment}`
    : "the top level"
  const source = await readFile(configPath, "utf8")
  const target = readPlacementTarget(source, options.environment)
  process.stdout.write(
    `Database: ${target.databaseName ?? target.databaseId ?? "unnamed"}, the DB binding in ${section} of wrangler.jsonc\n`
  )

  const { location, output } = await readD1Location(packageManager(), "DB", {
    cwd: root,
    env: options.accountId
      ? { ...process.env, CLOUDFLARE_ACCOUNT_ID: options.accountId }
      : process.env,
    environment: options.environment,
  })
  if (!location) {
    if (output) process.stderr.write(`${output}\n`)
    throw new Error(
      "Could not read where the primary is. Check that Wrangler is signed in to the account that owns the database (pnpm exec wrangler whoami) and that the database exists, then run this again."
    )
  }
  process.stdout.write(
    `Primary: ${location.colo}, location hint ${location.region}\n`
  )

  const region = placementRegionFor(location)
  if (!region) {
    throw new Error(
      `No placement region is known for ${location.colo} (${location.region}). Choose the nearest one from GET /accounts/{account_id}/workers/placement/regions and set it by hand (docs/DEPLOYMENT.md).`
    )
  }
  process.stdout.write(
    `\nRecommended, in ${section} of wrangler.jsonc:\n\n  "placement": ${placementValue(region)}\n\n`
  )

  if (target.placement?.region === region) {
    process.stdout.write("wrangler.jsonc already has this hint.\n")
    return
  }
  if (target.placement) {
    process.stdout.write(
      `It replaces the current "placement": ${JSON.stringify(target.placement)}.\n`
    )
  }
  if (!options.write) {
    process.stdout.write(
      "Run again with --write to write it, then commit wrangler.jsonc. The next deploy applies it.\n"
    )
    return
  }

  const temporaryPath = `${configPath}.placement-${process.pid}`
  await writeFile(
    temporaryPath,
    updatePlacement(source, { environment: options.environment, region })
  )
  await rename(temporaryPath, configPath)
  process.stdout.write(
    `Wrote it to ${section} of wrangler.jsonc. Commit the change; the next deploy applies it.\n`
  )
}

main().catch((error) => {
  process.stderr.write(
    `\nPlacement stopped: ${error instanceof Error ? error.message : String(error)}\n`
  )
  process.exitCode = 1
})
