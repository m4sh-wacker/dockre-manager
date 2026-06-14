import { defineConfig, devices } from '@playwright/test';

// Frontend (Next.js) URL. The backend defaults to :3030 (see api-helpers.ts).
const WEB_URL = process.env.E2E_WEB_URL || 'http://localhost:3000';

// By default the browser is VISIBLE (the journey is meant to be watched).
// Set E2E_HEADLESS=1 for headless / CI runs.
const headless = process.env.E2E_HEADLESS === '1';

// Slow each action down so the run is easy to follow with the naked eye.
// Override with E2E_SLOWMO (milliseconds); 0 disables it.
const slowMo = Number(process.env.E2E_SLOWMO ?? (headless ? 0 : 800));

export default defineConfig({
  testDir: './ui',
  // The journey deploys a real container (compose up --build) — give it room.
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',

  use: {
    baseURL: WEB_URL,
    headless,
    launchOptions: { slowMo },
    actionTimeout: 25_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Auto-start the frontend dev server from the (untouched) parent project,
  // but reuse it if it is already running. Disable entirely with
  // E2E_NO_WEBSERVER=1 (e.g. when you start the app yourself).
  webServer: process.env.E2E_NO_WEBSERVER === '1' ? undefined : {
    command: 'npm --prefix .. run dev',
    url: WEB_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
