import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 1 : 2,
  globalTimeout: 180_000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4324', browserName: 'chromium', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'node scripts/serve.mjs --preview --port 4324',
    url: 'http://127.0.0.1:4324',
    reuseExistingServer: false,
  },
});
