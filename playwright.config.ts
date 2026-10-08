import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 1, // Keep audio rendering and input timing consistent on ordinary PCs.
  forbidOnly: true,
  retries: 0,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    channel: 'msedge', // Jason's PC has no bundled Chromium
    headless: true,
    baseURL: 'http://127.0.0.1:4183',
    viewport: { width: 1280, height: 900 },
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4183 --strictPort',
    url: 'http://127.0.0.1:4183',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
