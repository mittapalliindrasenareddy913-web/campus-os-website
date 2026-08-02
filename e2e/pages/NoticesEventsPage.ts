import { Page, Locator, expect } from '@playwright/test';

export class NoticesEventsPage {
  readonly page: Page;
  readonly newNoticeBtn: Locator;
  readonly noticeTitleInput: Locator;
  readonly noticeContentInput: Locator;
  readonly noticeAudienceSelect: Locator;
  readonly publishNoticeBtn: Locator;
  readonly addEventBtn: Locator;
  readonly eventTitleInput: Locator;
  readonly eventDateInput: Locator;
  readonly saveEventBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newNoticeBtn = page.locator('button:has-text("Post Notice"), button:has-text("New Circular")');
    this.noticeTitleInput = page.locator('input[name="title"], input[placeholder*="title" i]');
    this.noticeContentInput = page.locator('textarea[name="content"], textarea[placeholder*="notice" i]');
    this.noticeAudienceSelect = page.locator('select[name="target"], select[name="audience"]');
    this.publishNoticeBtn = page.locator('button:has-text("Publish"), button:has-text("Post")');

    this.addEventBtn = page.locator('button:has-text("Add Event"), button:has-text("New Event")');
    this.eventTitleInput = page.locator('input[name="eventTitle"]');
    this.eventDateInput = page.locator('input[type="date"]');
    this.saveEventBtn = page.locator('button:has-text("Save Event")');
  }

  async publishNotice(title: string, content: string) {
    if (await this.newNoticeBtn.isVisible()) {
      await this.newNoticeBtn.click();
      await this.noticeTitleInput.fill(title);
      await this.noticeContentInput.fill(content);
      await this.publishNoticeBtn.click();
    }
  }
}
