import { test, expect } from '../fixtures/baseTest';
import { LoginPage } from '../pages/LoginPage';
import { PrincipalDashboardPage } from '../pages/PrincipalDashboardPage';
import { NoticesEventsPage } from '../pages/NoticesEventsPage';

test.describe('5. Campus Notices & Academic Calendar Events', () => {

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login('principal@campus.com', 'ASCET001', 'ASCET001');
  });

  test('Notices: Create and Publish Circular Notice', async ({ page }) => {
    const dashboardPage = new PrincipalDashboardPage(page);
    const noticesPage = new NoticesEventsPage(page);

    await dashboardPage.switchSubTab('Notices');
    await noticesPage.publishNotice(
      'Mid-Term Examination Schedule',
      'The II-Mid Examinations for IV Year B.Tech students will commence from Next Monday.'
    );
  });

  test('Calendar: Academic Event Display', async ({ page }) => {
    const dashboardPage = new PrincipalDashboardPage(page);

    await dashboardPage.switchSubTab('Calendar');
    await expect(page.locator('body')).toBeVisible();
  });

});
