# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 02_dashboard_nav.spec.ts >> 2. Dashboard Navigation & Subtab Switching >> Verify Executive Summary KPI Cards rendering
- Location: e2e\specs\02_dashboard_nav.spec.ts:36:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.kpi-card, .grid > div').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.kpi-card, .grid > div').first()

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
- textbox "••••••••": ASCET001
- checkbox "Remember Me"
- text: Remember Me
- link "Forgot Password?":
  - /url: "#forgot"
- button "Access Portal"
- button "Cancel"
```

# Test source

```ts
  1  | import { test, expect } from '../fixtures/baseTest';
  2  | import { LoginPage } from '../pages/LoginPage';
  3  | import { PrincipalDashboardPage } from '../pages/PrincipalDashboardPage';
  4  | 
  5  | test.describe('2. Dashboard Navigation & Subtab Switching', () => {
  6  | 
  7  |   test.beforeEach(async ({ page }) => {
  8  |     const loginPage = new LoginPage(page);
  9  |     await loginPage.login('principal@campus.com', 'ASCET001', 'ASCET001');
  10 |   });
  11 | 
  12 |   test('Click through every sidebar tab & subtab', async ({ page }) => {
  13 |     const dashboardPage = new PrincipalDashboardPage(page);
  14 | 
  15 |     const tabsToTest = [
  16 |       'Overview',
  17 |       'Departments',
  18 |       'Subjects',
  19 |       'Faculty',
  20 |       'Students',
  21 |       'Notices',
  22 |       'Calendar',
  23 |       'Timetable',
  24 |       'Leaves',
  25 |       'Marks'
  26 |     ];
  27 | 
  28 |     for (const tab of tabsToTest) {
  29 |       await test.step(`Switch to tab: ${tab}`, async () => {
  30 |         await dashboardPage.switchSubTab(tab);
  31 |         await expect(page.locator('body')).toBeVisible();
  32 |       });
  33 |     }
  34 |   });
  35 | 
  36 |   test('Verify Executive Summary KPI Cards rendering', async ({ page }) => {
  37 |     await expect(page.locator('body')).toBeVisible();
  38 |     // Check that numeric KPI elements exist on overview tab
  39 |     const cardElements = page.locator('.kpi-card, .grid > div');
> 40 |     await expect(cardElements.first()).toBeVisible({ timeout: 5000 });
     |                                        ^ Error: expect(locator).toBeVisible() failed
  41 |   });
  42 | 
  43 | });
  44 | 
```