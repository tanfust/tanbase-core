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

// Route components import these on first use, which the dev server's scan
// cannot see. Pre-bundling them at startup stops Vite from re-optimizing in
// the middle of a session, which reloads the page and can load React twice.
const routeDependencies = [
  "@tanstack/charts",
  "@tanstack/charts/react",
  "@tanstack/charts/scales/band",
  "@tanstack/charts/scales/linear",
  "@tanstack/charts/tooltip",
  "@tanstack/markdown/html",
  "@tanstack/markdown/parser",
  "@tanstack/react-form",
  "@tanstack/react-table",
]

const config = defineConfig(({ command, isPreview, mode }) => {
  // The dev server always runs the local environment, however it is started.
  // Builds keep the top level unless CLOUDFLARE_ENV names another, and the
  // e2e configuration has no environments.
  if (command === "serve" && !isPreview && mode !== "e2e") {
    process.env.CLOUDFLARE_ENV ??= "local"
  }

  return {
    resolve: { tsconfigPaths: true },
    optimizeDeps: { include: routeDependencies },
    environments: {
      ssr: { optimizeDeps: { include: routeDependencies } },
      // Small helpers that route options and route components share, such
      // as server function stubs, would each become a chunk that every page
      // preloads, and Lighthouse's simulation counts every request before the
      // first paint. Keep them in one chunk. Only leaf modules belong here:
      // grouping the router's own modules broke the order it initializes in.
      client: {
        build: {
          rolldownOptions: {
            output: {
              codeSplitting: {
                groups: [
                  {
                    name: "app-shared",
                    test: /[\\/]src[\\/](lib[\\/]site|modules[\\/](seo[\\/]head|og[\\/]cards|[a-z]+[\\/](functions|session|challenge|redirects)))\.ts$/,
                    includeDependenciesRecursively: false,
                    priority: 20,
                  },
                ],
              },
            },
          },
        },
      },
    },
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
  }
})

export default config
