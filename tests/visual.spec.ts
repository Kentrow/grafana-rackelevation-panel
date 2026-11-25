import { test, expect } from '@grafana/plugin-e2e';

// Screenshots of the demo dashboard in both themes, compared with the baselines of visual.spec.ts-snapshots. They
// run in the Playwright image of Docker against the Grafana version of docker-compose.yaml, the same on a laptop and
// in CI: `npm run e2e:visual`, and `npm run e2e:visual:update` to accept a change of the drawing.
const PANELS = ['Front', 'Both faces', 'Filtered by role'];

for (const theme of ['dark', 'light']) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      // A stable size, the grid following the width, and tall enough for every panel: Grafana loads the panels in view
      // only.
      await page.setViewportSize({ width: 1600, height: 2000 });
    });

    test('should draw the demo panels as before', async ({ gotoDashboardPage, readProvisionedDashboard, page }) => {
      const dashboard = await readProvisionedDashboard({ fileName: 'demo.json' });
      const dashboardPage = await gotoDashboardPage({ ...dashboard, queryParams: new URLSearchParams({ theme }) });
      await page.evaluate(() => document.fonts.ready);
      for (const title of PANELS) {
        const rack = dashboardPage.getPanelByTitle(title).locator.getByTestId('rack-panel');
        await expect(rack).toHaveScreenshot(`${theme}-${title.toLowerCase().replace(/ /g, '-')}.png`);
      }
    });

    test('should draw the device card as before', async ({ gotoDashboardPage, readProvisionedDashboard, page }) => {
      const dashboard = await readProvisionedDashboard({ fileName: 'demo.json' });
      const dashboardPage = await gotoDashboardPage({ ...dashboard, queryParams: new URLSearchParams({ theme }) });
      await page.evaluate(() => document.fonts.ready);
      await dashboardPage.getPanelByTitle('Both faces').locator.getByTestId('device-sw-a3-tor-01').first().hover();
      await expect(page.getByTestId('device-tooltip')).toHaveScreenshot(`${theme}-card.png`);
    });
  });
}
