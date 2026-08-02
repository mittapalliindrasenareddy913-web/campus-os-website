import { test as base, expect } from '@playwright/test';

export type TestFixtures = {
  consoleErrors: string[];
  networkFailures: { url: string; status: number; method: string }[];
};

export const test = base.extend<TestFixtures>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (exception) => {
      errors.push(`Unhandled Exception: ${exception.message}`);
    });

    await use(errors);
  },

  networkFailures: async ({ page }, use) => {
    const failures: { url: string; status: number; method: string }[] = [];
    page.on('response', (response) => {
      if (response.status() >= 400) {
        failures.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method(),
        });
      }
    });

    await use(failures);
  },
});

export { expect };
