import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly collegeCodeInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]');
    this.passwordInput = page.locator('input[type="password"], input[name="password"], input[placeholder*="password" i]');
    this.collegeCodeInput = page.locator('input[name="collegeCode"], input[placeholder*="college" i], input[placeholder*="code" i]');
    this.loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    this.errorMessage = page.locator('.toast-error, [role="alert"], .text-red-500, .bg-red-50');
  }

  async goto() {
    await this.page.goto('/login/principal');
  }

  async login(email = 'principal@campus.com', password = 'ASCET001', collegeCode = 'ASCET001') {
    await this.goto();
    if (await this.collegeCodeInput.isVisible()) {
      await this.collegeCodeInput.fill(collegeCode);
    }
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async assertLoginFailed() {
    await expect(this.errorMessage.first()).toBeVisible({ timeout: 5000 });
  }

  async assertLoggedIn() {
    await expect(this.page).toHaveURL(/.*dashboard.*/, { timeout: 10000 });
  }
}
