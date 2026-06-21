import { test, expect } from '@playwright/test';

// Path datum (the toolpath's own datum): which corner of the pattern anchors on the stock. It defaults to the
// STOCK's datum, so the path FOLLOWS the stock onto it instead of always running +X/+Y off a max-corner datum.
// The 3×3 picker on the 2D layout canvas overrides it. Placement rewrites the G-code (translateProgram).
test.use({ viewport: { width: 1280, height: 900 } });

const numsOf = (code, letter) => (code.match(new RegExp(letter + '\\s*(-?\\d*\\.?\\d+)', 'gi')) || []).map((t) => parseFloat(t.replace(new RegExp(letter, 'i'), '')));
const xsOf = (code) => numsOf(code, 'X');

async function setup(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
}

// Drive a 3-col single-row grid (holes at local X 0,20,40) with chosen datums / attach / offset.
async function code(page, opts = {}) {
  return page.evaluate(({ sd, pd, sa, oz, dia }) => {
    const s = window.ddcsGetSettings();
    s.stock = Object.assign(s.stock || {}, { x: 100, y: 80, z: 20, show: true, datum: sd });
    const set = (id, val) => { const e = document.getElementById(id); if (e) e.value = String(val); };
    set('d_pattern', 'grid'); set('d_cols', 3); set('d_rows', 1); set('d_dx', 20); set('d_dy', 20);
    set('d_originX', 0); set('d_originY', 0); set('d_pathDatum', pd || ''); set('d_stockAttach', sa || '');
    set('d_offZ', oz || 0); if (dia != null) set('d_holeDia', dia);
    window.ddcsStudio.wizardManager.update();
    return document.getElementById('wiz_drill_code').textContent;
  }, { sd: opts.stockDatum, pd: opts.pathDatum, sa: opts.stockAttach, oz: opts.offZ, dia: opts.holeDia });
}

test('default path datum follows the stock datum — a max-corner stock pulls the path onto the stock', async ({ page }) => {
  await setup(page);
  // Stock datum 'ppp' (max corner). pathDatum empty → follow the stock → the pattern's MAX corner lands on pos(0,0),
  // so the holes run -X onto the stock: X ∈ [-40, 0].
  const xs = xsOf(await code(page, { stockDatum: 'ppp', pathDatum: '' }));
  expect(Math.max(...xs)).toBeCloseTo(0, 1);
  expect(Math.min(...xs)).toBeCloseTo(-40, 1);
});

test('explicit path datum overrides — min-corner anchors the pattern +X off pos', async ({ page }) => {
  await setup(page);
  // Same max-corner stock, but pick 'nn' (min corner) → no shift, pattern runs +X: X ∈ [0, 40].
  const xs = xsOf(await code(page, { stockDatum: 'ppp', pathDatum: 'nn' }));
  expect(Math.min(...xs)).toBeCloseTo(0, 1);
  expect(Math.max(...xs)).toBeCloseTo(40, 1);
});

test('picking a stock-attach corner pulls the path to that corner of the stock', async ({ page }) => {
  await setup(page);
  // Min-corner stock datum, attach to the MAX corner ('pp'). pathDatum follows the attach, so the pattern's max
  // corner lands on the stock's max corner (100,80): the holes sit against the far edge, X ∈ [60, 100].
  const xs = xsOf(await code(page, { stockDatum: 'nnp', stockAttach: 'pp' }));
  expect(Math.max(...xs)).toBeCloseTo(100, 1);
  expect(Math.min(...xs)).toBeCloseTo(60, 1);
});

test('a signed Z offset shifts every Z move; hole diameter never moves the grid', async ({ page }) => {
  await setup(page);
  const base = await code(page, { stockDatum: 'nnp', holeDia: 6 });
  const zBase = Math.max(...numsOf(base, 'Z'));
  // +3 Z offset → top Z rises by 3.
  const shifted = await code(page, { stockDatum: 'nnp', holeDia: 6, offZ: 3 });
  expect(Math.max(...numsOf(shifted, 'Z'))).toBeCloseTo(zBase + 3, 1);
  // Changing the hole diameter must NOT move the pattern (anchored on hole centres).
  const wide = await code(page, { stockDatum: 'nnp', holeDia: 20 });
  expect(xsOf(wide)).toEqual(xsOf(base));
});

test('the 3×3 datum picker renders on the layout canvas and a click sets the path datum', async ({ page }) => {
  await setup(page);
  await code(page, { stockDatum: 'nnp', pathDatum: '' });
  const svg = page.locator('#drillLayoutCanvas svg');
  await expect(svg).toBeVisible();
  // The widget title is drawn as an SVG text node.
  await expect(svg.locator('text', { hasText: 'PATH' })).toBeVisible();
  // Click the top-left cell (= minX/maxY = 'np') and confirm it writes d_pathDatum.
  const hit = await page.evaluate(() => {
    const svg = document.querySelector('#drillLayoutCanvas svg');
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;   // 0 0 VW VH
    const sx = r.left + (20 / vb.width) * r.width;   // cell 'np' centre ≈ viewBox (20,34)
    const sy = r.top + (34 / vb.height) * r.height;
    return { sx, sy };
  });
  await page.mouse.click(hit.sx, hit.sy);
  await expect.poll(() => page.evaluate(() => document.getElementById('d_pathDatum').value)).toBe('np');
});

test('stock-attach markers sit on the stock corners and a click sets the attach corner', async ({ page }) => {
  await setup(page);
  await code(page, { stockDatum: 'nnp' });
  const marker = page.locator('#drillLayoutCanvas svg rect[data-attach="pp"]');
  await expect(marker).toBeVisible();
  const box = await marker.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => page.evaluate(() => document.getElementById('d_stockAttach').value)).toBe('pp');
});
