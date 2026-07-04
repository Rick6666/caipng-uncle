import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  webServer: { command: 'python3 -m http.server 8000', port: 8000, reuseExistingServer: true },
  use: { baseURL: 'http://localhost:8000', screenshot: 'only-on-failure' },
  projects: [{ name: 'iphone', use: { ...devices['iPhone 13'] } }]
});
