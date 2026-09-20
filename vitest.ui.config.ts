import { fileURLToPath } from "node:url"

import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [viteReact()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.ui.test.{ts,tsx}"],
  },
})
