import { test, expect } from '../fixtures/baseTest';
import { LoginPage } from '../pages/LoginPage';
import { PrincipalDashboardPage } from '../pages/PrincipalDashboardPage';

test.describe('1. Authentication & RBAC Privilege Verification', () => {

  test('Positive Case: Principal Login with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new PrincipalDashboardPage(page);

    await loginPage.goto();
    await loginPage.login('principal@campus.com', 'ASCET001', 'ASCET001');
    
    // Assert successful redirect to dashboard
    await dashboardPage.assertPrincipalAccess();
  });

  test('Negative Case: Login with invalid password fails gracefully', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login('principal@campus.com', 'WRONG_PASSWORD_123', 'ASCET001');
    
    // Expect error toast or error notification
    await loginPage.assertLoginFailed();
  });

  test('RBAC Elevation Guard: Principal role access verification', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new PrincipalDashboardPage(page);

    await loginPage.goto();
    await loginPage.login('principal@campus.com', 'ASCET001', 'ASCET001');
    await dashboardPage.assertPrincipalAccess();

    // Verify Principal role badge or menu header is visible
    await expect(page.locator('body')).toContainText(/principal/i);
  });

});
