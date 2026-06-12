import { test, expect } from '@playwright/test';

// Variables UI moved from #varList to the command deck's VARIABLES tab (v10.x keyboard
// tabs); chips are .deck-var-chip and insert via editorManager on click.
test('variable chip click inserts exactly once; command-deck keys insert once', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForSelector('#editor');

  // Open the controller dock and switch to the VARIABLES tab
  await page.waitForFunction(() => window.ddcsStudio);   // dock listeners attach on app init
  await page.click('#controller-dock .header-handle');
  await page.waitForSelector('#controller-dock.is-expanded');
  await page.click('[data-deck-tab="variables"]');
  await page.waitForSelector('.deck-var-chip', { timeout: 5000 });

  // clear editor
  await page.fill('#editor', '');

  // Click first variable chip (desktop behavior)
  const firstVar = page.locator('.deck-var-chip').first();
  await firstVar.click();

  // Read editor value and assert single '#' occurrence
  const val1 = await page.locator('#editor').evaluate((el) => el.value);
  const hashMatches1 = (val1.match(/#/g) || []).length;
  expect(hashMatches1).toBeGreaterThanOrEqual(1); // at least one variable inserted
  expect(hashMatches1).toBe(1); // exactly one insertion from single click

  // Now test command-deck SPACE (should insert a single space) — lives on the BASIC tab
  await page.fill('#editor', '');
  await page.click('[data-deck-tab="basic"]');
  const spaceBtn = page.locator('[data-ddcs-role="space"]');
  await expect(spaceBtn).toBeVisible();
  await spaceBtn.click();
  const val2 = await page.locator('#editor').evaluate((el) => el.value);
  expect(val2).toBe(' ');

  // Extra check: pointerdown then click on a variable chip must not double-insert
  await page.click('[data-deck-tab="variables"]');
  await page.fill('#editor', '');
  await firstVar.dispatchEvent('pointerdown');
  await firstVar.dispatchEvent('click');
  const val3 = await page.locator('#editor').evaluate((el) => el.value);
  const hashMatches3 = (val3.match(/#/g) || []).length;
  expect(hashMatches3).toBe(1);

  // (The old #varList wheel-to-horizontal-scroll behaviour was removed with the
  // var-list panel; the deck grid scrolls natively, so no scroll assertion here.)
});
