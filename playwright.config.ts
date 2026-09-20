import { defineConfig, devices } from "@playwright/test"

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: false,
  outputDir: "output/playwright/results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/playwright/report", open: "never" }],
  ],
  use: {
    baseURL: "http://localhost:3110",
    launchOptions: executablePath ? { executablePath } : undefined,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec vite dev --mode e2e --port 3110 --strictPort",
    url: "http://localhost:3110",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
