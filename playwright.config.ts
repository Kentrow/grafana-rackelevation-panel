import type { PluginOptions } from '@grafana/plugin-e2e';
import { defineConfig, devices } from '@playwright/test';
import baseConfig from './.config/playwright.config';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig<PluginOptions>(baseConfig, {
  // Add your own configuration here.
  // See https://grafana.com/developers/plugin-tools/how-to-guides/extend-configurations#extend-the-playwright-config for further info.
  // A dashboard of several racks can take more than the default 5 s to load on a busy machine or CI runner.
  expect: {
    timeout: 15_000,
    // The text may be antialiased a little differently on arm64 (a Mac) and amd64 (CI): a few dozen faint pixels. A
    // badge of another colour is a hundred.
    toHaveScreenshot: { maxDiffPixels: 50, animations: 'disabled' },
  },
  use: { ...baseConfig.use, screenshot: 'only-on-failure' },
  projects: [
    // The screenshots of visual.spec.ts are only compared in the Playwright image of Docker, by `npm run e2e:visual`:
    // the rendering of the text differs from one system to another.
    { name: 'chromium', testIgnore: /visual\.spec\.ts/ },
    {
      name: 'visual',
      testMatch: /visual\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/admin.json' },
      dependencies: ['auth'],
    },
  ],
});
