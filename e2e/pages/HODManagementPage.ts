import { Page, Locator, expect } from '@playwright/test';

export class HODManagementPage {
  readonly page: Page;
  readonly addHodButton: Locator;
  readonly hodNameInput: Locator;
  readonly hodEmailInput: Locator;
  readonly hodDeptSelect: Locator;
  readonly saveHodButton: Locator;
  readonly hodTableRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addHodButton = page.locator('button:has-text("Add HOD"), button:has-text("Assign HOD")');
    this.hodNameInput = page.locator('input[name="name"], input[placeholder*="name" i]');
    this.hodEmailInput = page.locator('input[name="email"], input[placeholder*="email" i]');
    this.hodDeptSelect = page.locator('select[name="department"], select[name="dept"]');
    this.saveHodButton = page.locator('button:has-text("Save"), button:has-text("Submit")');
    this.hodTableRows = page.locator('table tbody tr');
  }

  async openAddHodModal() {
    if (await this.addHodButton.isVisible()) {
      await this.addHodButton.click();
    }
  }

  async createHOD(name: string, email: string, dept: string) {
    await this.openAddHodModal();
    if (await this.hodNameInput.isVisible()) {
      await this.hodNameInput.fill(name);
      await this.hodEmailInput.fill(email);
      if (await this.hodDeptSelect.isVisible()) {
        await this.hodDeptSelect.selectOption(dept);
      }
      await this.saveHodButton.click();
    }
  }
}
