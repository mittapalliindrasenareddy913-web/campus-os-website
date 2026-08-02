# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 04_timetable_attendance.spec.ts >> 4. Timetable & Attendance Analytics >> Timetable: Slot Rendering & Formatting
- Location: e2e\specs\04_timetable_attendance.spec.ts:13:3

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Timetable"), [data-tab="timetable"]').first()

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications alt+T"
  - generic [ref=e4]:
    - generic [ref=e5]:
      - heading "CAMPUS OS" [level=1] [ref=e6]
      - heading "Principal Portal" [level=2] [ref=e7]
      - paragraph [ref=e8]: Workspace-enforced portal validations
    - generic [ref=e9]: ⚠️ College code is required.
    - generic [ref=e10]:
      - generic [ref=e11]:
        - generic [ref=e12]: Official Email / Super Admin Email
        - textbox "principal@college.edu or Super Admin email" [ref=e13]: principal@campus.com
      - generic [ref=e14]:
        - generic [ref=e15]: College Code
        - textbox "e.g. ASCET001" [ref=e16]
      - generic [ref=e17]:
        - generic [ref=e18]: Password
        - textbox "••••••••" [ref=e19]: ASCET001
      - generic [ref=e20]:
        - generic [ref=e21] [cursor=pointer]:
          - checkbox "Remember Me" [ref=e22]
          - text: Remember Me
        - link "Forgot Password?" [ref=e23] [cursor=pointer]:
          - /url: "#forgot"
      - button "Access Portal" [active] [ref=e24]
      - button "Cancel" [ref=e25]
```

# Test source

```ts
  1  | import { Page, Locator, expect } from '@playwright/test';
  2  | 
  3  | export class PrincipalDashboardPage {
  4  |   readonly page: Page;
  5  |   readonly sidebarHeader: Locator;
  6  |   readonly roleBadge: Locator;
  7  |   readonly tabOverview: Locator;
  8  |   readonly tabDepartments: Locator;
  9  |   readonly tabFaculty: Locator;
  10 |   readonly tabStudents: Locator;
  11 |   readonly tabSubjects: Locator;
  12 |   readonly tabTimetable: Locator;
  13 |   readonly tabNotices: Locator;
  14 |   readonly tabCalendar: Locator;
  15 |   readonly tabLeaves: Locator;
  16 |   readonly tabMarks: Locator;
  17 |   readonly searchInput: Locator;
  18 |   readonly branchFilter: Locator;
  19 |   readonly yearFilter: Locator;
  20 |   readonly semesterFilter: Locator;
  21 |   readonly prevPageBtn: Locator;
  22 |   readonly nextPageBtn: Locator;
  23 |   readonly kpiCards: Locator;
  24 | 
  25 |   constructor(page: Page) {
  26 |     this.page = page;
  27 |     this.sidebarHeader = page.locator('header, nav, .sidebar');
  28 |     this.roleBadge = page.locator('text=/principal/i');
  29 |     this.tabOverview = page.locator('button:has-text("Overview"), [data-tab="overview"]');
  30 |     this.tabDepartments = page.locator('button:has-text("Departments"), [data-tab="departments"]');
  31 |     this.tabFaculty = page.locator('button:has-text("Faculty"), [data-tab="faculty"]');
  32 |     this.tabStudents = page.locator('button:has-text("Students"), [data-tab="students"]');
  33 |     this.tabSubjects = page.locator('button:has-text("Subjects"), [data-tab="subjects"]');
  34 |     this.tabTimetable = page.locator('button:has-text("Timetable"), [data-tab="timetable"]');
  35 |     this.tabNotices = page.locator('button:has-text("Notices"), [data-tab="notices"]');
  36 |     this.tabCalendar = page.locator('button:has-text("Calendar"), [data-tab="calendar"]');
  37 |     this.tabLeaves = page.locator('button:has-text("Leaves"), [data-tab="leaves"]');
  38 |     this.tabMarks = page.locator('button:has-text("Marks"), [data-tab="marks"]');
  39 | 
  40 |     this.searchInput = page.locator('input[placeholder*="search" i]');
  41 |     this.branchFilter = page.locator('select[name="branch"], select:has-option("CSE")');
  42 |     this.yearFilter = page.locator('select[name="year"]');
  43 |     this.semesterFilter = page.locator('select[name="sem"]');
  44 |     this.prevPageBtn = page.locator('button:has-text("Prev"), button:has-text("<")');
  45 |     this.nextPageBtn = page.locator('button:has-text("Next"), button:has-text(">")');
  46 |     this.kpiCards = page.locator('.kpi-card, .bg-white.shadow, .grid > div');
  47 |   }
  48 | 
  49 |   async gotoDashboard() {
  50 |     await this.page.goto('/dashboard');
  51 |   }
  52 | 
  53 |   async switchSubTab(tabName: string) {
  54 |     const tabLocator = this.page.locator(`button:has-text("${tabName}"), [data-tab="${tabName.toLowerCase()}"]`).first();
> 55 |     await tabLocator.click();
     |                      ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  56 |     await this.page.waitForTimeout(300);
  57 |   }
  58 | 
  59 |   async searchRecord(query: string) {
  60 |     if (await this.searchInput.isVisible()) {
  61 |       await this.searchInput.fill(query);
  62 |       await this.page.keyboard.press('Enter');
  63 |     }
  64 |   }
  65 | 
  66 |   async applyFilters(branch?: string, year?: string) {
  67 |     if (branch && await this.branchFilter.isVisible()) {
  68 |       await this.branchFilter.selectOption(branch);
  69 |     }
  70 |     if (year && await this.yearFilter.isVisible()) {
  71 |       await this.yearFilter.selectOption(year);
  72 |     }
  73 |   }
  74 | 
  75 |   async assertPrincipalAccess() {
  76 |     await expect(this.page).toHaveURL(/.*dashboard.*/);
  77 |   }
  78 | }
  79 | 
```