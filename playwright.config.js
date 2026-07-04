import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  reporter: process.env.CI ? [['html', { open: 'never' }]] : [['list']],
  webServer: { command: 'python3 -m http.server 8000', port: 8000, reuseExistingServer: true },
  use: { baseURL: 'http://localhost:8000', screenshot: 'only-on-failure' },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
    // CI 用 chromium 跑同样的 iPhone 视口，避免每次都装 WebKit（04-test-plan §5）
    { name: 'chromium-mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } }
  ]
});
