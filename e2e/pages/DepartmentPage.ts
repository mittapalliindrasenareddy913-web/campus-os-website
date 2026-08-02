import { Page, Locator, expect } from '@playwright/test';

export class DepartmentPage {
  readonly page: Page;
  readonly addDeptBtn: Locator;
  readonly deptCodeInput: Locator;
  readonly deptNameInput: Locator;
  readonly saveDeptBtn: Locator;
  readonly deptCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addDeptBtn = page.locator('button:has-text("Add Dept"), button:has-text("New Department")');
    this.deptCodeInput = page.locator('input[name="code"], input[placeholder*="code" i]');
    this.deptNameInput = page.locator('input[name="name"], input[placeholder*="department name" i]');
    this.saveDeptBtn = page.locator('button:has-text("Save"), button:has-text("Create")');
    this.deptCards = page.locator('.dept-card, table tbody tr, .grid > div');
  }

  async createDepartment(code: string, name: string) {
    if (await this.addDeptBtn.isVisible()) {
      await this.addDeptBtn.click();
      await this.deptCodeInput.fill(code);
      await this.deptNameInput.fill(name);
      await this.saveDeptBtn.click();
    }
  }
}
