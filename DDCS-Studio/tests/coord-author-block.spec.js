import { test, expect } from '@playwright/test';

/**
 * The dev-mode "✎ positions" affordance on a coordlist block — the in-block twin of the form's coord-list editor,
 * the EXACT pattern region-pick set (a dev-mode pencil → opens the editor → writes back). The one divergence: the
 * list is the `pts` FIELD value (not block.data, which region-pick uses for its spec); the editor itself is the
 * SAME buildCoordEditor the form widget embeds. Locks: the affordance appears in dev mode, openCoordAuthor opens the
 * shared editor, and Done writes the edited list back to the PTS field (the inline positions preview redraws).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('dev mode: ✎ positions opens the coordinate editor and writes the list back to the coordlist block', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);

  // a coordlist block seeded with ONE point + a shared Z
  await page.evaluate(() => window.ddcsLoadBlockStack([
    { type: 'coordlist', params: { pts: JSON.stringify({ points: [{ x: 10, y: 10 }], z: -3 }) } },
  ]));
  await page.waitForTimeout(400);

  // enable dev mode → the coordlist block grows the ✎ positions affordance (the CLED input + a pencil image)
  await page.click('.blk-dev-toggle');
  await page.waitForTimeout(300);
  const hasAffordance = await page.evaluate(() => { const b = window.__blkws.getAllBlocks().find((x) => x.type === 'coordlist'); return !!(b && b.getInput('CLED')); });
  expect(hasAffordance, 'coordlist block grew the ✎ positions input in dev mode').toBe(true);
  expect(await page.locator('#blocks-app image').count(), 'pencil affordance rendered on the block').toBeGreaterThan(0);

  // trigger authoring the same way the pencil's onClick does (Blockly field clicks aren't reliably hit-testable in
  // Playwright; openCoordAuthor is the exact handler the pencil calls)
  await page.evaluate(async () => {
    const D = await import('/blocks/devMode.js');
    const b = window.__blkws.getAllBlocks().find((x) => x.type === 'coordlist');
    D.openCoordAuthor(b);
  });
  await expect(page.locator('#cl-modal')).toBeVisible();

  // add a point + set the shared Z, then Done → the edited list writes back to the PTS field
  await page.evaluate(() => {
    const m = document.getElementById('cl-modal');
    m.querySelector('.cl-add').click();                                       // ＋ Point → now 2 points
    const z = m.querySelector('.cl-z'); z.value = '-7'; z.dispatchEvent(new Event('input', { bubbles: true }));
    m.querySelector('[data-cl="done"]').click();
  });
  await expect(page.locator('#cl-modal')).toHaveCount(0);
  await page.waitForTimeout(200);

  const after = await page.evaluate(() => {
    const b = window.__blkws.getAllBlocks().find((x) => x.type === 'coordlist');
    let s = { points: [], z: 0 }; try { s = JSON.parse(b.getFieldValue('PTS')); } catch (_) { /* */ }
    const svg = b && b.getSvgRoot ? b.getSvgRoot() : null;
    return { count: s.points.length, z: s.z, markers: svg ? svg.querySelectorAll('[data-pi]').length : 0 };
  });
  expect(after.count, 'a point was added + written back to the PTS field').toBe(2);
  expect(after.z, 'the shared Z was written back to the field').toBe(-7);
  expect(after.markers, 'the inline positions preview redrew with the new point').toBe(2);

  await page.evaluate(() => window.ddcsLoadBlockStack && window.ddcsLoadBlockStack([]));
});
