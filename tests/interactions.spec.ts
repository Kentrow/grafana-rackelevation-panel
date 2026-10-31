import { test, expect } from '@grafana/plugin-e2e';

// demo.json is the demo dashboard: basic.csv and multi-rack/ through TestData, temperature
// thresholds, two data links, a device variable for the highlight and a role variable (switch) for the filter.

test('should highlight the device of var-device', async ({ gotoDashboardPage, readProvisionedDashboard }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'demo.json' });
  const dashboardPage = await gotoDashboardPage({
    ...dashboard,
    queryParams: new URLSearchParams({ 'var-device': 'sw-hq-core-01' }),
  });
  const panel = dashboardPage.getPanelByTitle('Front').locator;
  await expect(panel.getByTestId('device-sw-hq-core-01')).toHaveAttribute('data-emphasis', 'highlight');
  await expect(panel.getByTestId('device-fw-hq-01')).toHaveAttribute('data-emphasis', 'dim');

  await panel.getByTestId('clear-highlight').click();
  await expect(panel.getByTestId('device-sw-hq-core-01')).not.toHaveAttribute('data-emphasis');
  await expect(panel.getByTestId('clear-highlight')).toHaveCount(0);
});

test('should open the data links of a device with its values', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'demo.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  await dashboardPage.getPanelByTitle('Front').locator.getByTestId('device-fw-hq-01').click();
  await expect(page.getByRole('menuitem', { name: 'Open in NetBox' })).toHaveAttribute(
    'href',
    'https://netbox.example.com/dcim/devices/?q=fw-hq-01'
  );
  await expect(page.getByRole('menuitem', { name: 'Highlight in this dashboard' })).toHaveAttribute(
    'href',
    /var-device=fw-hq-01/
  );
});

test('should show the device card and its alerts on hover', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'demo.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  const panel = dashboardPage.getPanelByTitle('Both faces').locator;
  const device = panel.getByTestId('device-sw-a3-tor-01').first();
  await expect(device.getByTestId('alert-badge')).toHaveAttribute('data-count', '2');
  await device.hover();
  await expect(page.getByTestId('device-tooltip')).toContainText('Paris A3');
  await expect(page.getByTestId('device-tooltip-alerts')).toContainText('InterfaceErrors');
  await expect(page.getByTestId('device-tooltip-alerts')).toContainText('HighCpu');
});

test('should fade the devices out of the role filter without changing the racks', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'demo.json' });
  const dashboardPage = await gotoDashboardPage({
    ...dashboard,
    queryParams: new URLSearchParams({ viewPanel: 'panel-3' }),
  });
  const panel = dashboardPage.getPanelByTitle('Filtered by role').locator;
  await expect(panel.getByTestId('device-sw-a1-tor-01')).not.toHaveAttribute('data-emphasis');
  await expect(panel.getByTestId('device-srv-a1-01')).toHaveAttribute('data-emphasis', 'filtered');
  // Still drawn, the 0U band included: the rack keeps its shape.
  await expect(panel.getByTestId('rack-PAR1-A1').locator('[data-testid^="device-"]')).toHaveCount(15);
});

test('should open the links of a device from the keyboard', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'demo.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  const device = dashboardPage.getPanelByTitle('Front').locator.getByTestId('device-sw-hq-core-01');
  await device.focus();
  await expect(page.getByTestId('device-tooltip')).toContainText('Cisco C9300-48P');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Open in NetBox' })).toBeVisible();
});

test('should open the rack page from the rack name', async ({ gotoDashboardPage, readProvisionedDashboard, page }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'demo.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  const header = dashboardPage
    .getPanelByTitle('Both faces')
    .locator.getByTestId('rack-PAR1-A3')
    .first()
    .getByTestId('rack-header');
  // netbox.example.com does not exist: answer for it, to read the URL that the link opened.
  await page.context().route('https://netbox.example.com/**', (route) => route.fulfill({ body: 'NetBox' }));
  const popup = page.waitForEvent('popup');
  await header.click();
  expect((await popup).url()).toBe('https://netbox.example.com/dcim/racks/?q=PAR1-A3');
});

test('should show the free units and the legend', async ({ gotoDashboardPage, readProvisionedDashboard }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'demo.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  const panel = dashboardPage.getPanelByTitle('Front').locator;
  await expect(panel.getByTestId('rack-subtitle')).toContainText('U free');
  await expect(panel.getByTestId('rack-legend')).toContainText('4 in service');
});

for (const theme of ['light', 'dark']) {
  test(`should be readable in the ${theme} theme`, async ({
    gotoDashboardPage,
    readProvisionedDashboard,
    page,
  }, info) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'demo.json' });
    const dashboardPage = await gotoDashboardPage({ ...dashboard, queryParams: new URLSearchParams({ theme }) });
    await expect(dashboardPage.getPanelByTitle('Both faces').locator.getByTestId('rack-svg')).toBeVisible();
    // Captures for a human review of both themes, attached to the Playwright report.
    await info.attach(`demo-${theme}.png`, { body: await page.screenshot(), contentType: 'image/png' });
  });
}
