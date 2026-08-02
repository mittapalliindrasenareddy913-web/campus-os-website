import { Page, Locator, expect } from '@playwright/test';

export class PrincipalDashboardPage {
  readonly page: Page;
  readonly sidebarHeader: Locator;
  readonly roleBadge: Locator;
  readonly tabOverview: Locator;
  readonly tabDepartments: Locator;
  readonly tabFaculty: Locator;
  readonly tabStudents: Locator;
  readonly tabSubjects: Locator;
  readonly tabTimetable: Locator;
  readonly tabNotices: Locator;
  readonly tabCalendar: Locator;
  readonly tabLeaves: Locator;
  readonly tabMarks: Locator;
  readonly searchInput: Locator;
  readonly branchFilter: Locator;
  readonly yearFilter: Locator;
  readonly semesterFilter: Locator;
  readonly prevPageBtn: Locator;
  readonly nextPageBtn: Locator;
  readonly kpiCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebarHeader = page.locator('header, nav, .sidebar');
    this.roleBadge = page.locator('text=/principal/i');
    this.tabOverview = page.locator('button:has-text("Overview"), [data-tab="overview"]');
    this.tabDepartments = page.locator('button:has-text("Departments"), [data-tab="departments"]');
    this.tabFaculty = page.locator('button:has-text("Faculty"), [data-tab="faculty"]');
    this.tabStudents = page.locator('button:has-text("Students"), [data-tab="students"]');
    this.tabSubjects = page.locator('button:has-text("Subjects"), [data-tab="subjects"]');
    this.tabTimetable = page.locator('button:has-text("Timetable"), [data-tab="timetable"]');
    this.tabNotices = page.locator('button:has-text("Notices"), [data-tab="notices"]');
    this.tabCalendar = page.locator('button:has-text("Calendar"), [data-tab="calendar"]');
    this.tabLeaves = page.locator('button:has-text("Leaves"), [data-tab="leaves"]');
    this.tabMarks = page.locator('button:has-text("Marks"), [data-tab="marks"]');

    this.searchInput = page.locator('input[placeholder*="search" i]');
    this.branchFilter = page.locator('select[name="branch"], select:has-option("CSE")');
    this.yearFilter = page.locator('select[name="year"]');
    this.semesterFilter = page.locator('select[name="sem"]');
    this.prevPageBtn = page.locator('button:has-text("Prev"), button:has-text("<")');
    this.nextPageBtn = page.locator('button:has-text("Next"), button:has-text(">")');
    this.kpiCards = page.locator('.kpi-card, .bg-white.shadow, .grid > div');
  }

  async gotoDashboard() {
    await this.page.goto('/dashboard');
  }

  async switchSubTab(tabName: string) {
    const tabLocator = this.page.locator(`button:has-text("${tabName}"), [data-tab="${tabName.toLowerCase()}"]`).first();
    await tabLocator.click();
    await this.page.waitForTimeout(300);
  }

  async searchRecord(query: string) {
    if (await this.searchInput.isVisible()) {
      await this.searchInput.fill(query);
      await this.page.keyboard.press('Enter');
    }
  }

  async applyFilters(branch?: string, year?: string) {
    if (branch && await this.branchFilter.isVisible()) {
      await this.branchFilter.selectOption(branch);
    }
    if (year && await this.yearFilter.isVisible()) {
      await this.yearFilter.selectOption(year);
    }
  }

  async assertPrincipalAccess() {
    await expect(this.page).toHaveURL(/.*dashboard.*/);
  }
}
