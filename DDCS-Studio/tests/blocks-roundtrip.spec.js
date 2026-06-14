import { test, expect } from '@playwright/test';

// ROUND-TRIP: the Blocks tab's projected G-code travels back into the STUDIO code editor (the agreed return
// path — NOT the form). "Insert to STUDIO" mirrors a wizard's Insert: editorManager.insert(code) at the cursor,
// then switch to the Studio tab so the inserted code is visible.
test('Blocks → STUDIO: Insert to STUDIO puts the projected G-code in the editor and shows Studio', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsStudio.editorManager);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
  await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getTopBlocks(false).length > 0, { timeout: 8000 });
  await page.waitForTimeout(300);

  // Grab a distinctive projected line + the editor length before inserting.
  const before = await page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll('#blk-gcode .gl')).map((s) => s.textContent.trim()).filter(Boolean);
    const pick = lines.slice().sort((a, b) => b.length - a.length)[0] || '';   // longest line = most distinctive
    return { pick, count: lines.length, editorLen: window.ddcsStudio.editorManager.getValue().length };
  });
  expect(before.count, 'blocks produced projected G-code').toBeGreaterThan(0);

  await page.evaluate(() => document.getElementById('blk-to-studio').click());
  await page.waitForTimeout(200);

  const after = await page.evaluate((pick) => ({
    studioShown: !document.getElementById('studio-app').classList.contains('hidden'),
    editorHasLine: window.ddcsStudio.editorManager.getValue().includes(pick),
    editorLen: window.ddcsStudio.editorManager.getValue().length,
  }), before.pick);

  expect(after.editorHasLine, `editor contains the projected line "${before.pick}"`).toBe(true);
  expect(after.editorLen, 'editor grew by the inserted program').toBeGreaterThan(before.editorLen);
  expect(after.studioShown, 'switched to the Studio tab').toBe(true);
  expect(errs, 'no page errors').toEqual([]);
});
