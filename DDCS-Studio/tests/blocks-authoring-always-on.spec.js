import { test, expect } from '@playwright/test';

/**
 * ONE Blocks mode — authoring is ALWAYS ON (the normal/dev toggle + the two-state split are dissolved). Opening the
 * Blocks tab on a program shows each atom's "expose as param" affordances immediately (quiet by default), and the
 * Save-wizard button is always present. Ticking a field's EXPOSE checkbox lights up its marker (the emphasis). One
 * render path, no mode to flip. (Operators stay in the wizards; the Blocks tab is the author/learner surface.)
 */
test.use({ viewport: { width: 1400, height: 1000 } });

const findMarkLit = `(ws, BLOCKS, fieldKind, fieldsOf, FN) => {
  for (const b of ws.getAllBlocks()) {
    const def = BLOCKS[b.type]; if (!def) continue;
    for (const f of fieldsOf(def)) {
      if (fieldKind(def, f) !== 'value') continue;
      if (b.getField('EXPOSE_' + FN(f))) return { id: b.id, vk: FN(f) };
    }
  }
  return null;
}`;

test('Blocks authoring is always on: no toggle, save always present, expose marker lights up when exposed', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsLoadBlockStack);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);

  // seed a simple program with a numeric value (no toggle, no dev-mode dance)
  await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'move', params: { x: 0, y: 0, z: -5, mode: 'feed' } }]));
  await page.waitForTimeout(400);

  // the normal/dev toggle is GONE; the Save-wizard button is always present
  expect(await page.locator('.blk-dev-toggle').count(), 'the normal/dev toggle is dissolved').toBe(0);
  await expect(page.locator('.blk-dev-savebtn')).toBeVisible();

  // a numeric value grew its EXPOSE affordance + a dim marker WITHOUT any toggle click
  const r = await page.evaluate(async (finderSrc) => {
    const ws = window.__blkws;
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const { fieldKind, fieldsOf, FN } = await import('/blocks/blockly/bridge.js');
    const hit = eval('(' + finderSrc + ')')(ws, BLOCKS, fieldKind, fieldsOf, FN);
    if (!hit) return { found: false };
    const blk = ws.getBlockById(hit.id), vk = hit.vk;
    const mark = blk.getField('XMARK_' + vk);
    const textOf = (m) => { const g = m && m.getSvgRoot && m.getSvgRoot(); return g && (g.tagName.toLowerCase() === 'text' ? g : g.querySelector('text')); };
    const t0 = textOf(mark);
    const litBefore = t0 ? t0.classList.contains('blk-expose-lit') : null;
    blk.setFieldValue('TRUE', 'EXPOSE_' + vk);            // expose → marker should light up
    await new Promise((res) => setTimeout(res, 80));
    const t1 = textOf(mark);
    const litAfter = t1 ? t1.classList.contains('blk-expose-lit') : null;
    return { found: true, hasMark: !!mark, litBefore, litAfter };
  }, findMarkLit);

  expect(r.found, 'an EXPOSE affordance exists with no toggle click').toBe(true);
  expect(r.hasMark, 'the field grew a dim expose marker').toBe(true);
  expect(r.litBefore, 'dormant marker is not lit').toBe(false);
  expect(r.litAfter, 'exposing the field lights up its marker').toBe(true);

  await page.evaluate(() => window.ddcsLoadBlockStack && window.ddcsLoadBlockStack([]));
});
