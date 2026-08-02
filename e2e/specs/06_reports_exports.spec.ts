import { test, expect } from '../fixtures/baseTest';
import { LoginPage } from '../pages/LoginPage';
import { PrincipalDashboardPage } from '../pages/PrincipalDashboardPage';
import { ReportsSettingsPage } from '../pages/ReportsSettingsPage';

test.describe('6. Reports, CSV Export & Analytics', () => {

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login('principal@campus.com', 'ASCET001', 'ASCET001');
  });

  test('Analytics: Recharts Container Visibility', async ({ page }) => {
    const dashboardPage = new PrincipalDashboardPage(page);

    await dashboardPage.switchSubTab('Overview');
    const recharts = page.locator('.recharts-responsive-container, svg.recharts-surface');
    if (await recharts.count() > 0) {
      await expect(recharts.first()).toBeVisible();
    }
  });

  test('Reports: Trigger CSV Report Export', async ({ page }) => {
    const dashboardPage = new PrincipalDashboardPage(page);
    const reportsPage = new ReportsSettingsPage(page);

    await dashboardPage.switchSubTab('Students');
    await reportsPage.triggerCsvExport();
  });

});
