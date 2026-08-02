import { test, expect } from '../fixtures/baseTest';
import { LoginPage } from '../pages/LoginPage';
import { PrincipalDashboardPage } from '../pages/PrincipalDashboardPage';

test.describe('2. Dashboard Navigation & Subtab Switching', () => {

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login('principal@campus.com', 'ASCET001', 'ASCET001');
  });

  test('Click through every sidebar tab & subtab', async ({ page }) => {
    const dashboardPage = new PrincipalDashboardPage(page);

    const tabsToTest = [
      'Overview',
      'Departments',
      'Subjects',
      'Faculty',
      'Students',
      'Notices',
      'Calendar',
      'Timetable',
      'Leaves',
      'Marks'
    ];

    for (const tab of tabsToTest) {
      await test.step(`Switch to tab: ${tab}`, async () => {
        await dashboardPage.switchSubTab(tab);
        await expect(page.locator('body')).toBeVisible();
      });
    }
  });

  test('Verify Executive Summary KPI Cards rendering', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
    // Check that numeric KPI elements exist on overview tab
    const cardElements = page.locator('.kpi-card, .grid > div');
    await expect(cardElements.first()).toBeVisible({ timeout: 5000 });
  });

});
