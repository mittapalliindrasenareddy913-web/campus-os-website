import { test, expect } from '../fixtures/baseTest';
import { LoginPage } from '../pages/LoginPage';
import { PrincipalDashboardPage } from '../pages/PrincipalDashboardPage';
import { TimetableAttendancePage } from '../pages/TimetableAttendancePage';

test.describe('4. Timetable & Attendance Analytics', () => {

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login('principal@campus.com', 'ASCET001', 'ASCET001');
  });

  test('Timetable: Slot Rendering & Formatting', async ({ page }) => {
    const dashboardPage = new PrincipalDashboardPage(page);
    const timetablePage = new TimetableAttendancePage(page);

    await dashboardPage.switchSubTab('Timetable');
    await timetablePage.selectDay('Monday');
    await timetablePage.assertSlotsVisible();
  });

  test('Attendance: Breakdown metrics rendering', async ({ page }) => {
    const dashboardPage = new PrincipalDashboardPage(page);

    await dashboardPage.switchSubTab('Overview');
    // Ensure attendance charts / cards are rendered
    await expect(page.locator('body')).toContainText(/attendance/i);
  });

});
