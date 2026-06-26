import { test, expect } from '@playwright/test';

/**
 * Step 3 — the dev-mode "✎ regions" affordance on a regionpick block (the DECIDED entry point: blocks stay the one
 * authoring surface). In dev mode a regionpick block grows a pencil affordance → opens the region editor → writes
 * the authored spec back to the SAME block.data channel the runtime + round-trip already use. Locks: the affordance
 * appears in dev mode, clicking it opens the editor, and saving writes the spec onto the block (field redraws).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('dev mode: ✎ regions opens the editor and writes the spec back to the regionpick block', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);

  // a move with a FRESH regionpick pill (empty spec) in its feed socket
  await page.evaluate(() => window.ddcsLoadBlockStack([
    { type: 'move', params: { x: 0, y: 0, z: -5, feed: { type: 'regionpick', params: { name: 'feed', value: 0, spec: '' } } } },
  ]));
  await page.waitForTimeout(400);

  // authoring is always on → the regionpick block already grew its ✎ affordance (no toggle)
  await page.waitForTimeout(300);
  const hasAffordance = await page.evaluate(() => { const b = window.__blkws.getAllBlocks().find((x) => x.type === 'regionpick'); return !!(b && b.getInput('RGNED')); });
  expect(hasAffordance, 'regionpick block grew the ✎ regions input').toBe(true);

  // the pencil also renders as a FieldImage on the block (the visible affordance)
  expect(await page.locator('#blocks-app image').count(), 'pencil affordance rendered on the block').toBeGreaterThan(0);

  // trigger authoring the same way the pencil's onClick does (Blockly field clicks aren't reliably hit-testable in
  // Playwright — the workspace bg intercepts; the other block tests assert render+data, not clicks). openRegionAuthor
  // is the exact handler the pencil calls.
  await page.evaluate(async () => {
    const D = await import('/blocks/devMode.js');
    const b = window.__blkws.getAllBlocks().find((x) => x.type === 'regionpick');
    D.openRegionAuthor(b);
  });
  await expect(page.locator('#re-modal')).toBeVisible();

  // author a region (value 750) + save → the editor writes the spec back to the block
  await page.evaluate(() => {
    const m = document.getElementById('re-modal');
    m.querySelector('[data-add="rect"]').click();
    const v = m.querySelector('#re_val'); v.value = '750'; v.dispatchEvent(new Event('input', { bubbles: true }));
    m.querySelector('[data-re="save"]').click();
  });
  await expect(page.locator('#re-modal')).toHaveCount(0);
  await page.waitForTimeout(200);

  const after = await page.evaluate(() => {
    const b = window.__blkws.getAllBlocks().find((x) => x.type === 'regionpick');
    let spec = null; try { spec = JSON.parse(JSON.parse(b.data).spec); } catch (_) { /* */ }
    const svg = b && b.getSvgRoot ? b.getSvgRoot() : null;
    return { value: b && b.getFieldValue('VALUE'), regionCount: spec ? spec.regions.length : 0, regionVal: spec && spec.regions[0] && spec.regions[0].value, drawn: svg ? svg.querySelectorAll('[data-ri]').length : 0 };
  });
  expect(after.regionCount, 'spec written to block.data').toBe(1);
  expect(after.regionVal).toBe(750);
  expect(after.value, 'field value defaulted to the authored region').toBe('750');
  expect(after.drawn, 'the inline picker redrew the authored region').toBe(1);

  await page.evaluate(() => window.ddcsLoadBlockStack && window.ddcsLoadBlockStack([]));
});
