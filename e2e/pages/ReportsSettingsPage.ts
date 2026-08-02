import { Page, Locator, expect } from '@playwright/test';

export class ReportsSettingsPage {
  readonly page: Page;
  readonly rechartsContainer: Locator;
  readonly exportCsvBtn: Locator;
  readonly institutionNameInput: Locator;
  readonly saveSettingsBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.rechartsContainer = page.locator('.recharts-responsive-container, svg.recharts-surface');
    this.exportCsvBtn = page.locator('button:has-text("Export CSV"), button:has-text("Download Report")');
    this.institutionNameInput = page.locator('input[name="collegeName"], input[name="institutionName"]');
    this.saveSettingsBtn = page.locator('button:has-text("Save Settings")');
  }

  async triggerCsvExport() {
    if (await this.exportCsvBtn.isVisible()) {
      const downloadPromise = this.page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      await this.exportCsvBtn.click();
      return await downloadPromise;
    }
    return null;
  }
}
