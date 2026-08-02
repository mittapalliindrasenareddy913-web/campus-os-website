# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 06_reports_exports.spec.ts >> 6. Reports, CSV Export & Analytics >> Reports: Trigger CSV Report Export
- Location: e2e\specs\06_reports_exports.spec.ts:23:3

# Error details

```
TimeoutError: locator.fill: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('input[type="email"], input[name="email"], input[placeholder*="email" i]')

```

# Test source

```ts
  1  | import { Page, Locator, expect } from '@playwright/test';
  2  | 
  3  | export class LoginPage {
  4  |   readonly page: Page;
  5  |   readonly emailInput: Locator;
  6  |   readonly passwordInput: Locator;
  7  |   readonly collegeCodeInput: Locator;
  8  |   readonly loginButton: Locator;
  9  |   readonly errorMessage: Locator;
  10 | 
  11 |   constructor(page: Page) {
  12 |     this.page = page;
  13 |     this.emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]');
  14 |     this.passwordInput = page.locator('input[type="password"], input[name="password"], input[placeholder*="password" i]');
  15 |     this.collegeCodeInput = page.locator('input[name="collegeCode"], input[placeholder*="college" i], input[placeholder*="code" i]');
  16 |     this.loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
  17 |     this.errorMessage = page.locator('.toast-error, [role="alert"], .text-red-500, .bg-red-50');
  18 |   }
  19 | 
  20 |   async goto() {
  21 |     await this.page.goto('/login/principal');
  22 |   }
  23 | 
  24 |   async login(email = 'principal@campus.com', password = 'ASCET001', collegeCode = 'ASCET001') {
  25 |     await this.goto();
  26 |     if (await this.collegeCodeInput.isVisible()) {
  27 |       await this.collegeCodeInput.fill(collegeCode);
  28 |     }
> 29 |     await this.emailInput.fill(email);
     |                           ^ TimeoutError: locator.fill: Timeout 15000ms exceeded.
  30 |     await this.passwordInput.fill(password);
  31 |     await this.loginButton.click();
  32 |   }
  33 | 
  34 |   async assertLoginFailed() {
  35 |     await expect(this.errorMessage.first()).toBeVisible({ timeout: 5000 });
  36 |   }
  37 | 
  38 |   async assertLoggedIn() {
  39 |     await expect(this.page).toHaveURL(/.*dashboard.*/, { timeout: 10000 });
  40 |   }
  41 | }
  42 | 
```