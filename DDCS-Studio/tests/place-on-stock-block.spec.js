import { test, expect } from '@playwright/test';

// The placement is a semantic block: opening a drill op in the Blocks tab shows a PlaceOnStock C-block wrapping the
// Array{ Drill } — the intent (attach corner) lives in the block, visible + editable, not baked into numbers.
test.use({ viewport: { width: 1400, height: 1000 } });

test('drill op surfaces the placement as a PlaceOnStock C-block wrapping the pattern', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);

  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = Object.assign(s.stock || {}, { x: 100, y: 80, z: 20, show: true, datum: 'nnp' }); });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => { document.getElementById('d_stockAttach').value = 'pp'; window.ddcsStudio.wizardManager.update(); });   // → recordOp('drill', …)

  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0);
  await page.waitForTimeout(150);

  const r = await page.evaluate(() => {
    const blocks = window.__blkws.getAllBlocks();
    const place = blocks.find((b) => b.type === 'placeonstock');
    return {
      types: blocks.map((b) => b.type),
      isCblock: place ? (place.inputList || []).some((i) => i.name === 'DO' && i.type === 3) : false,   // input_statement = a C-mouth
      attach: place ? place.getFieldValue('STOCKATTACH') : null,
    };
  });
  expect(r.types, 'the Blocks view has a PlaceOnStock block').toContain('placeonstock');
  expect(r.types, 'wrapping the Array pattern').toContain('array');
  expect(r.isCblock, 'PlaceOnStock is a C-block (has a DO statement mouth)').toBe(true);
  expect(r.attach, 'the attach corner is carried IN the block (semantic)').toBe('pp');
});

const maxX = (s) => Math.max(...(s.match(/X\s*(-?\d*\.?\d+)/gi) || []).map((t) => parseFloat(t.replace(/X/i, ''))));

test('editing the PlaceOnStock attach corner in Blockly re-emits the placed G-code (snapshot survives)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsGetBlockGcode);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = Object.assign(s.stock || {}, { x: 100, y: 80, z: 20, show: true, datum: 'nnp' }); });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = String(v); };
    set('d_cols', 3); set('d_rows', 1); set('d_dx', 20); set('d_originX', 0); set('d_originY', 0); set('d_stockAttach', 'pp');
    window.ddcsStudio.wizardManager.update();
  });

  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0);
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => window.ddcsGetBlockGcode());

  // Change the attach corner to Front-left in Blockly (the snapshot — stock dims/bbox — must ride along for it to work).
  await page.evaluate(() => window.__blkws.getAllBlocks().find((b) => b.type === 'placeonstock').setFieldValue('nn', 'STOCKATTACH'));
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => window.ddcsGetBlockGcode());

  expect(maxX(before), "attached to the stock's far corner → holes reach the far edge").toBeCloseTo(100, 0);
  expect(maxX(after), 'attached front-left → holes pull to the near corner (attach now takes effect)').toBeCloseTo(40, 0);
});

test('PlaceOnStock shows the inline 3×3 corner-grid fields, coloured per datum, click-to-pick', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = Object.assign(s.stock || {}, { x: 100, y: 80, z: 20, show: true, datum: 'nnp' }); });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => {
    document.getElementById('d_stockAttach').value = 'pp';   // attach picked → a blue cell
    document.getElementById('d_pathDatum').value = 'cc';     // path datum picked → an amber cell
    window.ddcsStudio.wizardManager.update();
  });
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0);
  await page.waitForTimeout(150);

  const r = await page.evaluate(() => {
    // Scope to the Blockly workspace SVG — the wizard form's pickers draw the SAME cornergrid graphic, so an
    // unscoped rect[data-code] would also count those 18 cells.
    const cells = [...document.querySelectorAll('.blocklySvg rect[data-code]')].map((c) => (c.getAttribute('fill') || '').toLowerCase());
    return {
      n: cells.length, blue: cells.includes('#4ab3ff'), amber: cells.includes('#ffcf3a'),
      darkCross: document.querySelectorAll('.blocklySvg line[stroke="#10151b"]').length,   // bold crosshair on the picked cells
    };
  });
  expect(r.n, 'two inline 3×3 grids = 18 cells rendered on the block').toBe(18);
  expect(r.blue, 'the stock-attach picked cell is blue').toBe(true);
  expect(r.amber, 'the path-datum picked cell is amber').toBe(true);
  expect(r.darkCross, 'each picked cell shows a bold datum crosshair (2 selected × 2 lines)').toBeGreaterThanOrEqual(4);

  // REAL click through Blockly's gesture (a synthetic dispatch bypasses it and would pass falsely — the actual bug).
  const box = await page.evaluate(() => {
    const cell = window.__blkws.getAllBlocks().find((b) => b.type === 'placeonstock').getField('STOCKATTACH')._cells['nn'];
    const r = cell.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(box.x, box.y);
  await expect.poll(() => page.evaluate(() => window.__blkws.getAllBlocks().find((b) => b.type === 'placeonstock').getFieldValue('STOCKATTACH'))).toBe('nn');
});

test('block→wizard reverse-sync: editing the PlaceOnStock anchor in Blocks flows back to the wizard form', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = Object.assign(s.stock || {}, { x: 100, y: 80, z: 20, show: true, datum: 'nnp' }); });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => { document.getElementById('d_stockAttach').value = ''; window.ddcsStudio.wizardManager.update(); });

  // View as blocks, then edit the PlaceOnStock stock-attach corner to 'pp'.
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().some((b) => b.type === 'placeonstock'));
  await page.evaluate(() => window.__blkws.getAllBlocks().find((b) => b.type === 'placeonstock').getField('STOCKATTACH').setValue('pp'));
  // The edit must reach the program stack the reconciler reads.
  await expect.poll(() => page.evaluate(() => {
    const find = (p) => { for (const b of (p || [])) { if (b.type === 'placeonstock') return b; if (b.children) { const f = find(b.children); if (f) return f; } } return null; };
    const pb = find(window.ddcsGetBlockProgram && window.ddcsGetBlockProgram());
    return pb && pb.params ? pb.params.stockAttach : null;
  })).toBe('pp');

  // Switch back to Studio → the OPEN wizard's form reflects the block edit.
  await page.evaluate(() => window.showApp('studio'));
  await expect.poll(() => page.evaluate(() => document.getElementById('d_stockAttach').value)).toBe('pp');
});
