import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_SITE_PORT ?? 43192);
const basePath = "/sector-zero/site";
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/site",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  outputDir:
    process.env.PLAYWRIGHT_OUTPUT_DIR ??
    path.join(os.tmpdir(), "sector-zero-site-playwright-results", String(port)),
  use: {
    baseURL: `${origin}${basePath}/`,
    browserName: "chromium",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "yarn --cwd ../site dev --hostname 127.0.0.1",
    url: `${origin}${basePath}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      COREPACK_ENABLE_PROJECT_SPEC: "0",
      PORT: String(port),
      NEXT_PUBLIC_BASE_PATH: basePath,
    },
  },
});
