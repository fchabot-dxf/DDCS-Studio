import { test, expect } from '@playwright/test';

// Clear must wipe the block-program MODEL (blocks/programModel.js), not just the editor textarea. Otherwise the
// accumulated ops linger: a blur re-projects them and the next Insert appends onto them — the "clear keeps it in
// cache" bug. This drives the real Insert (wizardManager.insert) + Clear (window.clearCode) paths.
test.use({ viewport: { width: 1280, height: 900 } });

const countOps = (page) => page.evaluate(() => (window.ddcsGetBlockProgram() || []).filter((b) => b && b.type === 'op').length);
const editorLen = (page) => page.evaluate(() => (document.getElementById('editor').value || '').trim().length);

async function insertOp(page, kind) {
  await page.evaluate((k) => window.ddcsStudio.wizardManager.open(k), kind);
  await page.waitForSelector(`#wiz_${kind}`, { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForTimeout(150);
  await page.evaluate(() => window.ddcsStudio.wizardManager.insert());
  await page.waitForTimeout(200);
}

test('Clear wipes the program model so the next Insert does not re-accumulate', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram && window.clearCode);

  await insertOp(page, 'drill');
  expect(await countOps(page), 'one op after first insert').toBe(1);
  expect(await editorLen(page), 'editor shows the projected program').toBeGreaterThan(0);

  await page.evaluate(() => window.clearCode());
  await page.waitForTimeout(120);
  expect(await countOps(page), 'program model is empty after Clear').toBe(0);
  expect(await editorLen(page), 'editor is empty after Clear').toBe(0);

  // Second insert must be the ONLY op — not appended onto the cleared one.
  await insertOp(page, 'drill');
  expect(await countOps(page), 'second insert starts fresh (no cached op)').toBe(1);
});
