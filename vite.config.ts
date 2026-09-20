import { defineConfig } from "vite"
import { cloudflare } from "@cloudflare/vite-plugin"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

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
  ],
}))

export default config
