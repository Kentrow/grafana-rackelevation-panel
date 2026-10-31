import { test, expect } from '@grafana/plugin-e2e';

// The provisioned dashboard.json feeds the panel tests/fixtures through TestData (CSV content).

test('should display "No data" when the query returns nothing', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  await expect(dashboardPage.getPanelByTitle('No data').locator).toContainText('No data');
});

test('should draw the rack of basic.csv', async ({ gotoDashboardPage, readProvisionedDashboard }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  const rack = dashboardPage.getPanelByTitle('Basic rack').locator.getByTestId('rack-RACK-HQ-01');
  await expect(rack.locator('[data-testid^="device-"]')).toHaveCount(6);
  await expect(rack.getByTestId('device-wlc-hq-02')).toHaveAttribute('data-state', 'down');
  await expect(rack.getByTestId('device-wlc-hq-01')).toContainText('62.0 °C');
});

test('should read three Prometheus frames joined by field', async ({ gotoDashboardPage, readProvisionedDashboard }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  const raw = dashboardPage.getPanelByTitle('Prometheus, not joined').locator;
  await expect(raw.getByTestId('device-fw-hq-01')).toHaveAttribute('data-state', 'unknown');
  const joined = dashboardPage.getPanelByTitle('Prometheus, joined').locator;
  await expect(joined.getByTestId('device-fw-hq-01')).toHaveAttribute('data-state', 'up');
  await expect(joined.getByTestId('device-wlc-hq-02')).toHaveAttribute('data-state', 'down');
  await expect(joined.getByTestId('device-fw-hq-01')).toContainText('41.0 °C');
});
