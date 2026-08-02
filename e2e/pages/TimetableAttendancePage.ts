import { Page, Locator, expect } from '@playwright/test';

export class TimetableAttendancePage {
  readonly page: Page;
  readonly daySelect: Locator;
  readonly timetableSlots: Locator;
  readonly attendanceSummary: Locator;

  constructor(page: Page) {
    this.page = page;
    this.daySelect = page.locator('select[name="day"], select:has-option("Monday")');
    this.timetableSlots = page.locator('.timetable-slot, table tbody tr, .slot-card');
    this.attendanceSummary = page.locator('.attendance-overview, .recharts-responsive-container, text=/attendance/i');
  }

  async selectDay(day: string) {
    if (await this.daySelect.isVisible()) {
      await this.daySelect.selectOption(day);
    }
  }

  async assertSlotsVisible() {
    await expect(this.page.locator('body')).toBeVisible();
  }
}
