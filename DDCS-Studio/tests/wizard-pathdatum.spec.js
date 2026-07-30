import { test, expect } from '@playwright/test';

// Path datum (the toolpath's own datum): which corner of the pattern anchors on the stock. It defaults to the
// STOCK's datum, so the path FOLLOWS the stock onto it instead of always running +X/+Y off a max-corner datum.
// The 3×3 picker on the 2D layout canvas overrides it. Placement rewrites the G-code (translateProgram).
test.use({ viewport: { width: 1280, height: 900 } });

const numsOf = (code, letter) => (code.match(new RegExp(letter + '\\s*(-?\\d*\\.?\\d+)', 'gi')) || []).map((t) => parseFloat(t.replace(new RegExp(letter, 'i'), '')));

/**
 * ── t1385 — WHERE THE HOLES ARE IS MEASURED FROM THE TRACE, NOT SCRAPED FROM THE TEXT ─────────────────────────────
 *
 * `xsOf` pulled literal X words out of the G-code. That worked while the pattern was unrolled at build time — one `G0 X20`
 * per hole. THE SWITCH walks the pattern at RUNTIME, so a hole's X is `X[0 + #75]`: no literal to scrape, an empty match
 * array, and `Math.max()` of nothing is **-Infinity** (`Math.min()` → +Infinity). The asserts did not become wrong; they
 * became unanswerable from text.
 *
 * Every one of them is a claim about WHERE THE TOOL GOES, so it is measured there — the engine resolves the registers and
 * the assert reads the resulting CUT positions. That is the value against an independent truth. It is also stricter than
 * the old scrape, which counted rapids, retracts and any incidental X word as if they were hole positions.
 *
 * ⚠ AND IT REPAIRS A SILENT VACUITY, not only the reds: the "hole diameter never moves the grid" assert compares
 * `xsOf(wide)` with `xsOf(base)`. Post-switch both are the EMPTY ARRAY, so it passed while comparing nothing — it would
 * have gone on passing if the diameter had moved every hole. Fixed here even though it was green.
 */
const cutXs = (page, code) => page.evaluate(async (text) => {
    const { traceToolpath } = await import('/engine/trace.js');
    const segs = (traceToolpath(text).segments || []).filter((s) => !s.rapid);
    // The DISTINCT cut positions, rounded to the emit quantum — a hole is one position however many pecks reach it.
    return [...new Set(segs.map((s) => (+s.x2.toFixed(3)) + 0))].sort((a, b) => a - b);
}, code);

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
  const xs = await cutXs(page, await code(page, { stockDatum: 'ppp', pathDatum: '' }));
  expect(xs.length, 'the traced path really cuts (an empty measurement is what -Infinity used to hide)').toBe(3);
  expect(Math.max(...xs), "the pattern's MAX corner lands on pos(0,0)").toBeCloseTo(0, 1);
  expect(Math.min(...xs), 'so the three holes run -X onto the stock').toBeCloseTo(-40, 1);
});

test('explicit path datum overrides — min-corner anchors the pattern +X off pos', async ({ page }) => {
  await setup(page);
  // Same max-corner stock, but pick 'nn' (min corner) → no shift, pattern runs +X: X ∈ [0, 40].
  const xs = await cutXs(page, await code(page, { stockDatum: 'ppp', pathDatum: 'nn' }));
  expect(xs.length, 'three holes traced').toBe(3);
  expect(Math.min(...xs), 'the min corner anchors at pos, so no shift').toBeCloseTo(0, 1);
  expect(Math.max(...xs), 'and the pattern runs +X').toBeCloseTo(40, 1);
});

test('picking a stock-attach corner pulls the path to that corner of the stock', async ({ page }) => {
  await setup(page);
  // Min-corner stock datum, attach to the MAX corner ('pp'). pathDatum follows the attach, so the pattern's max
  // corner lands on the stock's max corner (100,80): the holes sit against the far edge, X ∈ [60, 100].
  const xs = await cutXs(page, await code(page, { stockDatum: 'nnp', stockAttach: 'pp' }));
  expect(xs.length, 'three holes traced').toBe(3);
  expect(Math.max(...xs), "the pattern's max corner lands on the stock's max corner").toBeCloseTo(100, 1);
  expect(Math.min(...xs), 'so the holes sit against the far edge').toBeCloseTo(60, 1);
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
  const baseXs = await cutXs(page, base), wideXs = await cutXs(page, wide);
  expect(baseXs.length, 'the baseline really has hole positions to compare (this compared two EMPTY arrays before)').toBe(3);
  expect(wideXs, 'a wider hole does not move the grid — anchored on hole CENTRES').toEqual(baseXs);
});

test('the placement persists through insert (baked into the block stack, not a post-translate)', async ({ page }) => {
  await setup(page);
  await code(page, { stockDatum: 'nnp', stockAttach: 'pp' });   // attach the path to the stock's max corner
  const res = await page.evaluate(async () => {
    await window.ddcsStudio.wizardManager.insert();
    const prog = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
    const op = prog.find((b) => b && b.type === 'op' && b.opType === 'drill');
    if (!op) return null;
    const place = (op.children || []).find((c) => c.type === 'placeonstock');
    // t1385 — the wrapped child is the merged `holecycle`, not an `array` container (the switch folded the pattern in).
    const hole = place && (place.children || []).find((c) => c.type === 'holecycle');
    return { opAttach: op.params && op.params.stockAttach, blockAttach: place && place.params && place.params.stockAttach, hasHole: !!hole };
  });
  expect(res, 'a drill op was committed').toBeTruthy();
  expect(res.opAttach, 'op.params remembers the attach (wizard re-edit)').toBe('pp');
  expect(res.blockAttach, 'the PlaceOnStock C-block carries the attach (visible/editable in Blocks)').toBe('pp');
  expect(res.hasHole, 'the pattern is wrapped inside the PlaceOnStock block (t1385: the holecycle block, was the array)').toBe(true);
});

test('the form anchor pickers set the PATH and STOCK anchors (3×3 cells)', async ({ page }) => {
  await setup(page);
  await code(page, { stockDatum: 'nnp', pathDatum: '' });
  const mount = page.locator('.pa-mount[data-prefix="d_"]');
  await expect(mount, 'the STOCK + PATH anchor pickers are in the drill form').toBeVisible();
  // PATH ANCHOR picker → pick the back-left corner ('np').
  await mount.locator('.ap[data-field="d_pathDatum"] rect[data-code="np"]').click();
  await expect.poll(() => page.evaluate(() => document.getElementById('d_pathDatum').value)).toBe('np');
  // STOCK ANCHOR picker → pick the front-right corner ('pn').
  await mount.locator('.ap[data-field="d_stockAttach"] rect[data-code="pn"]').click();
  await expect.poll(() => page.evaluate(() => document.getElementById('d_stockAttach').value)).toBe('pn');
  // Re-clicking the picked PATH cell clears back to "follow".
  await mount.locator('.ap[data-field="d_pathDatum"] rect[data-code="np"]').click();
  await expect.poll(() => page.evaluate(() => document.getElementById('d_pathDatum').value)).toBe('');
});

test('the 2D layout renders the pattern PLACED on the stock (matches the 3D)', async ({ page }) => {
  await setup(page);
  // Attach to the max corner → the pattern's far hole must sit on the stock's far (max-X) edge in the LAYOUT too.
  await code(page, { stockDatum: 'nnp', stockAttach: 'pp' });
  const m = await page.evaluate(() => {
    const svg = document.querySelector('#drillLayoutCanvas svg');
    const stock = svg.querySelector('rect.fc-stock');
    const holes = [...svg.querySelectorAll('circle.fc-hole')];
    return { stockRight: stock.x.baseVal.value + stock.width.baseVal.value, maxHole: Math.max(...holes.map((c) => c.cx.baseVal.value)), n: holes.length };
  });
  expect(m.n).toBeGreaterThan(0);
  expect(Math.abs(m.maxHole - m.stockRight), 'the far hole renders on the stock far edge (2D pattern is placed)').toBeLessThan(8);
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
