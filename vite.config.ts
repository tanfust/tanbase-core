import { defineConfig } from "vite"
import type { PluginOption } from "vite"
import { cloudflare } from "@cloudflare/vite-plugin"
import posthog from "@posthog/rollup-plugin"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

/**
 * Uploads the browser bundle's source maps to PostHog Error Tracking, then
 * deletes them so they are never served. Only the deploying Workers Build
 * uploads: the production build on Workers Builds with the upload variables
 * set. Local builds, GitHub CI, and the `pnpm verify` step skip it. A failed
 * upload fails the deploy.
 */
function postHogSourceMaps(): PluginOption[] {
  const { POSTHOG_API_KEY, POSTHOG_CLI_HOST, POSTHOG_PROJECT_ID } = process.env
  const deploying =
    process.env.WORKERS_CI === "1" &&
    process.env.CLOUDFLARE_ENV === "production"
  if (!deploying || !POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) return []

  return [
    {
      ...posthog({
        personalApiKey: POSTHOG_API_KEY,
        projectId: POSTHOG_PROJECT_ID,
        host: POSTHOG_CLI_HOST,
        sourcemaps: { enabled: true, deleteAfterUpload: true },
      }),
      // Worker exceptions are not sent to PostHog; leave its bundle alone.
      applyToEnvironment: (environment) => environment.name === "client",
    },
  ]
}

const config = defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    ...(mode === "test"
      ? []
      : [
          cloudflare({
            configPath:
              mode === "e2e" ? "wrangler.e2e.jsonc" : "wrangler.jsonc",
            persistState:
              mode === "e2e" ? { path: ".wrangler/e2e-state" } : true,
            viteEnvironment: { name: "ssr" },
          }),
        ]),
    tailwindcss(),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/*.server.*", "**/src/db/**", "**/src/platform/**"],
        },
      },
    }),
    viteReact(),
    ...postHogSourceMaps(),
  ],
}))

export default config
