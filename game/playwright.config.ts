import os from "node:os";
import path from "node:path";

import { defineConfig } from "@playwright/test";

const artifactRoot = process.env.PLAYWRIGHT_OUTPUT_DIR
  ?? path.join(os.tmpdir(), "sector-zero-playwright-results");

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  reporter: "list",
  outputDir: artifactRoot,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "yarn dev --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      COREPACK_ENABLE_PROJECT_SPEC: "0",
    },
  },
  projects: [
    {
      name: "desktop-keyboard",
      grep: /@(fixture|keyboard)/,
      use: {
        browserName: "chromium",
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "desktop-pointer",
      grep: /@pointer/,
      use: {
        browserName: "chromium",
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "mobile-touch",
      grep: /@touch/,
      use: {
        browserName: "chromium",
        viewport: { width: 480, height: 854 },
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
});
