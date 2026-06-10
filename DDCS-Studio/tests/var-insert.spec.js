import { test, expect } from '@playwright/test';

test('variable chip click inserts exactly once; command-deck keys insert once', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // wait for editor and var-list to be ready
  await page.waitForSelector('#editor');
  await page.waitForSelector('#varList .var-item', { timeout: 5000 });

  // clear editor
  await page.fill('#editor', '');

  // Click first variable chip (desktop behavior)
  const firstVar = page.locator('#varList .var-item').first();
  await firstVar.click();

  // Read editor value and assert single '#' occurrence
  const val1 = await page.locator('#editor').evaluate((el) => el.value);
  const hashMatches1 = (val1.match(/#/g) || []).length;
  expect(hashMatches1).toBeGreaterThanOrEqual(1); // at least one variable inserted
  expect(hashMatches1).toBe(1); // exactly one insertion from single click

  // Now test command-deck SPACE (should insert a single space)
  // Ensure editor is cleared first
  await page.fill('#editor', '');
  const spaceBtn = page.locator('[data-ddcs-role="space"]');
  await expect(spaceBtn).toBeVisible();

  // Click the space button (commandDeck uses pointerdown internally)
  await spaceBtn.click();
  const val2 = await page.locator('#editor').evaluate((el) => el.value);
  // Expect exactly one space character inserted
  expect(val2).toBe(' ');

  // Extra check: simulate pointerdown then click on variable chip (race scenario)
  await page.fill('#editor', '');
  // dispatch pointerdown first (this will call pointerdown handler if present), then dispatch click
  await firstVar.dispatchEvent('pointerdown');
  await firstVar.dispatchEvent('click');
  const val3 = await page.locator('#editor').evaluate((el) => el.value);
  const hashMatches3 = (val3.match(/#/g) || []).length;
  // pointerdown should perform the single insert and the following click must NOT duplicate it
  expect(hashMatches3).toBe(1);

  // verify vertical wheel scroll causes horizontal scrolling in var list
  // add enough dummy items to guarantee overflow
  await page.evaluate(() => {
    const list = document.getElementById('varList');
    if (list) {
      while (list.scrollWidth <= list.clientWidth + 10) {
        const d = document.createElement('div'); d.className = 'var-item'; d.innerText = 'X';
        list.appendChild(d);
      }
    }
  });
  const before = await page.evaluate("document.getElementById('varList').scrollLeft");
  await page.evaluate("document.getElementById('varList').dispatchEvent(new WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true}))");
  const after = await page.evaluate("document.getElementById('varList').scrollLeft");
  expect(after).not.toBe(before);
});