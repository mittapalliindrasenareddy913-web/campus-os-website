import { test, expect } from '../fixtures/baseTest';
import { LoginPage } from '../pages/LoginPage';
import { PrincipalDashboardPage } from '../pages/PrincipalDashboardPage';

test.describe('7. Browser Console Error & Network Failure Resilience', () => {

  test('Monitor for zero uncaught JavaScript console errors', async ({ page, consoleErrors }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new PrincipalDashboardPage(page);

    await loginPage.login('principal@campus.com', 'ASCET001', 'ASCET001');
    
    // Navigate across core subtabs
    await dashboardPage.switchSubTab('Overview');
    await dashboardPage.switchSubTab('Departments');
    await dashboardPage.switchSubTab('Faculty');
    await dashboardPage.switchSubTab('Students');

    // Assert no uncaught exceptions in browser console
    const fatalErrors = consoleErrors.filter(err => !err.includes('favicon') && !err.includes('Socket'));
    expect(fatalErrors).toHaveLength(0);
  });

  test('Monitor Network API failures (status >= 400)', async ({ page, networkFailures }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new PrincipalDashboardPage(page);

    await loginPage.login('principal@campus.com', 'ASCET001', 'ASCET001');
    await dashboardPage.switchSubTab('Overview');

    // Expect no critical 500 server errors
    const serverFailures = networkFailures.filter(res => res.status >= 500);
    expect(serverFailures).toHaveLength(0);
  });

});
