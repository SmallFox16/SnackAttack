import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('homepage has no WCAG 2.1 A/AA accessibility violations', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');

  const results = await new AxeBuilder({ page })
    .withTags([
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa'
    ])
    .analyze();

  expect(results.violations).toEqual([]);
});
