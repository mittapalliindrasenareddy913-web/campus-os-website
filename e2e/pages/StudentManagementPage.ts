import { Page, Locator, expect } from '@playwright/test';

export class StudentManagementPage {
  readonly page: Page;
  readonly addStudentBtn: Locator;
  readonly rollNoInput: Locator;
  readonly studentNameInput: Locator;
  readonly studentEmailInput: Locator;
  readonly branchSelect: Locator;
  readonly yearSelect: Locator;
  readonly sectionSelect: Locator;
  readonly saveStudentBtn: Locator;
  readonly importCsvBtn: Locator;
  readonly fileInput: Locator;
  readonly studentRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addStudentBtn = page.locator('button:has-text("Add Student"), button:has-text("New Student")');
    this.rollNoInput = page.locator('input[name="rollNo"], input[placeholder*="roll" i]');
    this.studentNameInput = page.locator('input[name="name"], input[placeholder*="student name" i]');
    this.studentEmailInput = page.locator('input[name="email"]');
    this.branchSelect = page.locator('select[name="branch"]');
    this.yearSelect = page.locator('select[name="year"]');
    this.sectionSelect = page.locator('select[name="section"]');
    this.saveStudentBtn = page.locator('button:has-text("Save"), button:has-text("Register")');
    this.importCsvBtn = page.locator('button:has-text("Import"), button:has-text("Bulk Import")');
    this.fileInput = page.locator('input[type="file"]');
    this.studentRows = page.locator('table tbody tr');
  }

  async addStudent(rollNo: string, name: string, email: string) {
    if (await this.addStudentBtn.isVisible()) {
      await this.addStudentBtn.click();
      await this.rollNoInput.fill(rollNo);
      await this.studentNameInput.fill(name);
      await this.studentEmailInput.fill(email);
      await this.saveStudentBtn.click();
    }
  }

  async uploadCsv(filePath: string) {
    if (await this.importCsvBtn.isVisible()) {
      await this.importCsvBtn.click();
      if (await this.fileInput.isVisible()) {
        await this.fileInput.setInputFiles(filePath);
      }
    }
  }
}
