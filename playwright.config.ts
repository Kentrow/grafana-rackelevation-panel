import type { PluginOptions } from '@grafana/plugin-e2e';
import { defineConfig } from '@playwright/test';
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
  expect: { timeout: 15_000 },
  use: { ...baseConfig.use, screenshot: 'only-on-failure' },
});
