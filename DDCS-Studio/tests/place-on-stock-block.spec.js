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
