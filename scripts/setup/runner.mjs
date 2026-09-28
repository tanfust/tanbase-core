import { spawn, spawnSync } from "node:child_process"

import { d1LocationArgs, parseD1Location } from "./core.mjs"

export function commandAvailable(command) {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0
}

export function packageManager() {
  if (commandAvailable("pnpm")) return { command: "pnpm", prefix: [] }
  if (commandAvailable("corepack")) {
    return { command: "corepack", prefix: ["pnpm"] }
  }
  throw new Error(
    "pnpm is required. Install the supported Node.js release, enable Corepack, and run setup again."
  )
}

export function run(
  command,
  args,
  {
    allowFailure = false,
    capture = false,
    cwd,
    echo = true,
    env = process.env,
  } = {}
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
    })
    let output = ""
    let errorOutput = ""

    if (capture) {
      child.stdout.on("data", (chunk) => {
        const value = chunk.toString()
        output += value
        if (echo) process.stdout.write(value)
      })
      child.stderr.on("data", (chunk) => {
        const value = chunk.toString()
        errorOutput += value
        if (echo) process.stderr.write(value)
      })
    }

    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0 || allowFailure) {
        resolve({ code: code ?? 1, errorOutput, output })
        return
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} exited with status ${code ?? "unknown"}.`
        )
      )
    })
  })
}

export function runPnpm(manager, args, options) {
  return run(manager.command, [...manager.prefix, ...args], options)
}

export function runWrangler(manager, args, options) {
  return runPnpm(manager, ["exec", "wrangler", ...args], options)
}

/**
 * Where a D1 database's primary is, `{ colo, region }`, from one read-only
 * remote query, with Wrangler's output for reporting a failure. It never
 * throws: a location that cannot be read is null.
 */
export async function readD1Location(
  manager,
  database,
  { cwd, env, environment } = {}
) {
  try {
    const result = await runWrangler(
      manager,
      d1LocationArgs(database, environment),
      { allowFailure: true, capture: true, cwd, echo: false, env }
    )
    return {
      location: result.code === 0 ? parseD1Location(result.output) : null,
      output: `${result.output}\n${result.errorOutput}`.trim(),
    }
  } catch (error) {
    return {
      location: null,
      output: error instanceof Error ? error.message : String(error),
    }
  }
}
