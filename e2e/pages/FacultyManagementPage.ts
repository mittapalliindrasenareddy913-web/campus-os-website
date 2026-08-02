import { Page, Locator, expect } from '@playwright/test';

export class FacultyManagementPage {
  readonly page: Page;
  readonly addFacultyBtn: Locator;
  readonly facultyNameInput: Locator;
  readonly facultyEmailInput: Locator;
  readonly designationSelect: Locator;
  readonly departmentSelect: Locator;
  readonly saveFacultyBtn: Locator;
  readonly facultyRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addFacultyBtn = page.locator('button:has-text("Add Faculty"), button:has-text("New Staff")');
    this.facultyNameInput = page.locator('input[name="name"], input[placeholder*="faculty name" i]');
    this.facultyEmailInput = page.locator('input[name="email"]');
    this.designationSelect = page.locator('select[name="designation"]');
    this.departmentSelect = page.locator('select[name="dept"], select[name="department"]');
    this.saveFacultyBtn = page.locator('button:has-text("Save"), button:has-text("Add")');
    this.facultyRows = page.locator('table tbody tr');
  }

  async addFaculty(name: string, email: string, designation: string) {
    if (await this.addFacultyBtn.isVisible()) {
      await this.addFacultyBtn.click();
      await this.facultyNameInput.fill(name);
      await this.facultyEmailInput.fill(email);
      if (await this.designationSelect.isVisible()) {
        await this.designationSelect.selectOption(designation);
      }
      await this.saveFacultyBtn.click();
    }
  }
}
