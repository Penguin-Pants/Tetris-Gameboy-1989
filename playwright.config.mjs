import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.mjs',
  timeout: 60000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    browserName: 'chromium'
  }
});
