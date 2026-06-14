import { test, expect } from '@playwright/test';

// ROUND-TRIP (live projection): the block stack is the source of truth and the STUDIO editor IS its live
// projection — the Blocks tab pushes its emitted G-code straight into the editor on every change (no button,
// no tab-switch copy). Studio and Blocks share one projected program. (Editing the projected code back into
// blocks is layer 3; this guards layer 2 — the projection direction.)
test('Blocks → STUDIO: the editor is the live projection of the block program', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsStudio.editorManager);
  await page.evaluate(() => window.ddcsStudio.editorManager.setValue('( pre-existing scratch )'));
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
  await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getTopBlocks(false).length > 0, { timeout: 8000 });
  await page.waitForTimeout(300);

  // Editor now mirrors the block program — WITHOUT switching to Studio.
  const a = await page.evaluate(() => ({
    editor: window.ddcsStudio.editorManager.getValue(),
    blk: window.ddcsGetBlockGcode(),
  }));
  expect(a.blk.length, 'blocks produced projected G-code').toBeGreaterThan(0);
  expect(a.editor, 'editor mirrors the live block projection').toBe(a.blk);

  // Change the block program → the editor follows live (no tab switch).
  await page.evaluate(() => window.ddcsLoadBlockStack([
    { type: 'comment', params: { text: 'LIVE PROJECTION' } },
    { type: 'move', params: { mode: 'rapid', x: 5, y: 5, z: 5 } },
  ]));
  await page.waitForTimeout(200);
  const b = await page.evaluate(() => ({
    editor: window.ddcsStudio.editorManager.getValue(),
    blk: window.ddcsGetBlockGcode(),
  }));
  expect(b.editor.includes('LIVE PROJECTION'), 'editor updated to the new block program').toBe(true);
  expect(b.editor, 'editor still equals the live projection after a change').toBe(b.blk);
  expect(errs, 'no page errors').toEqual([]);
});
