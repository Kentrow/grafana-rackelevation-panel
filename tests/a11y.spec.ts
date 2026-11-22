import { test, expect } from '@grafana/plugin-e2e';

// axe (WCAG 2.0 and 2.1, levels A and AA) on the panels only: the rest of the page belongs to Grafana.
for (const theme of ['dark', 'light']) {
  for (const fileName of ['demo.json', 'fixtures.json']) {
    test(`should have no accessibility violations in ${fileName}, ${theme} theme`, async ({
      gotoDashboardPage,
      readProvisionedDashboard,
      scanForA11yViolations,
      page,
    }) => {
      const dashboard = await readProvisionedDashboard({ fileName });
      await gotoDashboardPage({ ...dashboard, queryParams: new URLSearchParams({ theme }) });
      await expect(page.getByTestId('rack-panel').first()).toBeVisible();
      const report = await scanForA11yViolations({ include: '[data-testid="rack-panel"]' });
      expect(report).toHaveNoA11yViolations();
    });
  }
}
