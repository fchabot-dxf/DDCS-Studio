import { test, expect } from '@playwright/test';

// Slot arrays: the slot wizard can repeat the slot in a grid/line/circle/rect pattern by wrapping the Slot atom in
// an Array container (just like drill = array(hole)) — the pattern offsets copies of the A↔B slot. 'single' = one
// slot, unchanged (no Array wrapper).
test.use({ viewport: { width: 1280, height: 900 } });

test('slot array repeats the slot across the pattern; single = one slot', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const sw = await import('/wizards/slotWizard.js');
    const bm = await import('/blocks/blockEmitter.js');
    const base = { ax: 0, ay: 0, bx: 40, by: 0, width: 6, toolDia: 6, depth: 4, stepdown: 2 };
    const emit = (extra) => bm.emitProgram(sw.slotStack({ ...base, ...extra }));
    const stamps = (g) => (g.match(/ @ -?\d/g) || []).length;   // one "( <op> N @ x,y )" marker per stamped copy
    const line = emit({ pattern: 'line', count: 3, spacing: 30, angle: 0 });
    return {
      single: emit({ pattern: 'single' }),
      lineStamps: stamps(line), line,
      gridStamps: stamps(emit({ pattern: 'grid', cols: 2, rows: 2, dx: 40, dy: 30 })),
      circleStamps: stamps(emit({ pattern: 'circle', dia: 80, count: 6, startAngle: 0 })),
      bbox: sw.slotArrayBBox({ ...base, pattern: 'line', count: 3, spacing: 30, angle: 0 }),
    };
  });
  expect(r.single, 'single = no array stamps').not.toMatch(/ @ -?\d/);
  expect(r.lineStamps, 'line count 3 → 3 stamps').toBe(3);
  expect(r.gridStamps, 'grid 2×2 → 4 stamps').toBe(4);
  expect(r.circleStamps, 'circle count 6 → 6 stamps').toBe(6);
  // The line array offsets copies of the A→B(=X40) slot by 30 → a copy ends at X70.
  expect(r.line, 'a repeated slot lands +30 along (B X40 → X70)').toContain('X70');
  // The array footprint spreads the slot bbox by the pattern (base maxX≈40 + 2·30 = 100).
  expect(r.bbox.maxX, 'array bbox spans all copies').toBeGreaterThan(95);
});

test('block→wizard reverse-sync: editing the slot array pattern in Blocks flows back to the form', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('slot'));
  await page.waitForSelector('#wiz_slot', { state: 'visible' });
  await page.evaluate(() => { document.getElementById('sl_pattern').value = 'line'; window.ddcsStudio.wizardManager.update(); });

  // View as blocks → the slot is wrapped in an Array; flip its pattern to grid.
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().some((b) => b.type === 'array'));
  await page.evaluate(() => window.__blkws.getAllBlocks().find((b) => b.type === 'array').getField('PATTERN').setValue('grid'));
  await expect.poll(() => page.evaluate(() => {
    const find = (p) => { for (const b of (p || [])) { if (b.type === 'array') return b; if (b.children) { const f = find(b.children); if (f) return f; } } return null; };
    const a = find(window.ddcsGetBlockProgram && window.ddcsGetBlockProgram());
    return a && a.params ? a.params.pattern : null;
  })).toBe('grid');

  // Back to Studio → the open wizard's pattern field reflects the block edit.
  await page.evaluate(() => window.showApp('studio'));
  await expect.poll(() => page.evaluate(() => document.getElementById('sl_pattern').value)).toBe('grid');
});
