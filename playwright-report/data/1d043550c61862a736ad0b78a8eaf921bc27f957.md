# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01_auth_rbac.spec.ts >> 1. Authentication & RBAC Privilege Verification >> Negative Case: Login with invalid password fails gracefully
- Location: e2e\specs\01_auth_rbac.spec.ts:18:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.toast-error, [role="alert"], .text-red-500, .bg-red-50').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.toast-error, [role="alert"], .text-red-500, .bg-red-50').first()

```

```yaml
- region "Notifications alt+T"
- heading "CAMPUS OS" [level=1]
- heading "Principal Portal" [level=2]
- paragraph: Workspace-enforced portal validations
- text: ⚠️ College code is required. Official Email / Super Admin Email
- textbox "principal@college.edu or Super Admin email": principal@campus.com
- text: College Code
- textbox "e.g. ASCET001"
- text: Password
- textbox "••••••••": WRONG_PASSWORD_123
- checkbox "Remember Me"
- text: Remember Me
- link "Forgot Password?":
  - /url: "#forgot"
- button "Access Portal"
- button "Cancel"
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
  29 |     await this.emailInput.fill(email);
  30 |     await this.passwordInput.fill(password);
  31 |     await this.loginButton.click();
  32 |   }
  33 | 
  34 |   async assertLoginFailed() {
> 35 |     await expect(this.errorMessage.first()).toBeVisible({ timeout: 5000 });
     |                                             ^ Error: expect(locator).toBeVisible() failed
  36 |   }
  37 | 
  38 |   async assertLoggedIn() {
  39 |     await expect(this.page).toHaveURL(/.*dashboard.*/, { timeout: 10000 });
  40 |   }
  41 | }
  42 | 
```