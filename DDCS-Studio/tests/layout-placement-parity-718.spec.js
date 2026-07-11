import { test, expect } from '@playwright/test';

/**
 * t718 LAYOUT PLACEMENT PARITY — a user live-find (contour: "top right edges seem offset"): the 2D previewGeometry rings/
 * handles drew at RAW originX while the traced toolpath (the placed emit) drew PLACED, so a non-default stockAttach/pathDatum
 * split them apart. The consumer (layoutSpecFromOp) now resolves the op's DECLARED placement shift (placeShiftOfStack — the
 * SAME placeShiftFromParams the emit bakes) and draws the previewGeometry PLACED. This asserts the previewGeometry now
 * COINCIDES with the emit toolpath (numerically, not by eye), across the mill twins + at default (where they always agreed).
 */
test.use({ viewport: { width: 1300, height: 980 } });

async function openTwin(page, opType, cfg) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; });
    await page.evaluate((t) => window.openWiz(t), opType);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
    for (const [k, v] of Object.entries(cfg || {})) await page.evaluate(([k2, v2]) => { const f = document.querySelector(`#wiz_user_form [data-param="${k2}"]`); if (f) { f.value = v2; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); } }, [k, v]);
    await page.waitForTimeout(500);
}

// The feature (previewGeometry) world bbox (calibrated off the stock rect: world 0..200 x 0..150, datum nnp) + the emit
// toolpath bbox parsed from the code — the two things that MUST coincide once the previewGeometry is placed.
const measure = (page) => page.evaluate(() => {
    const st = document.querySelector('#wiz_user .fc-stock').getBoundingClientRect();
    const sx = st.width / 200, sy = st.height / 150, left = st.left, bottom = st.bottom;
    const feats = [...document.querySelectorAll('#wiz_user .fc-path, #wiz_user .fc-guide')];
    let u = null; for (const p of feats) { const r = p.getBoundingClientRect(); if (!r.width && !r.height) continue; u = u ? { left: Math.min(u.left, r.left), right: Math.max(u.right, r.right), top: Math.min(u.top, r.top), bottom: Math.max(u.bottom, r.bottom) } : { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }
    const fc = u ? { minX: (u.left - left) / sx, maxX: (u.right - left) / sx, minY: (bottom - u.bottom) / sy, maxY: (bottom - u.top) / sy } : null;
    const code = document.querySelector('#wiz_user_code').textContent || '';
    let mnX = 1e9, mxX = -1e9, mnY = 1e9, mxY = -1e9;
    for (const ln of code.split('\n')) { const mx = ln.match(/X(-?\d+\.?\d*)/), my = ln.match(/Y(-?\d+\.?\d*)/); if (mx) { mnX = Math.min(mnX, +mx[1]); mxX = Math.max(mxX, +mx[1]); } if (my) { mnY = Math.min(mnY, +my[1]); mxY = Math.max(mxY, +my[1]); } }
    const tr = mxX > -1e9 ? { minX: mnX, maxX: mxX, minY: mnY, maxY: mxY } : null;
    const ctr = (b) => b ? { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 } : null;
    return { fc, tr, fcC: ctr(fc), trC: ctr(tr), nfeat: feats.length };
});

// THE REPRO — contour, stockAttach='cc' + pathDatum='cc' (the split config): the previewGeometry offset ring must equal
// the placed toolpath EXTENT within ε (not just the centre) — the tight numeric coincidence the user's offset revealed.
test('contour cc/cc: the previewGeometry EXTENT equals the placed toolpath extent (the repro, coincident)', async ({ page }) => {
    await openTwin(page, 'user_contour_data', { w: 180, h: 120, originX: 0, originY: 0, stockAttach: 'cc', pathDatum: 'cc' });
    const m = await measure(page);
    expect(m.fc, 'the previewGeometry is drawn').toBeTruthy();
    expect(m.tr, 'the emit has a toolpath').toBeTruthy();
    for (const k of ['minX', 'maxX', 'minY', 'maxY']) expect(Math.abs(m.fc[k] - m.tr[k]), `contour ${k}: ring==trace`).toBeLessThan(1.0);
    const _bb = await page.locator('#wiz_user').boundingBox();   // t710 convention: boundingBox+clip (idle-3D locator.screenshot stalls)
    if (_bb) await page.screenshot({ path: 'scratchpad/parity-contour-cc.png', clip: _bb });
});

// PER-TWIN SWEEP — with a non-default placement, the placed previewGeometry CENTRE coincides with the emit toolpath centre
// (ε=4mm covers the ring-display vs helix/raster nuances of bore/surfacing; a RAW-drawn feature would be tens of mm off).
for (const { op, name, cfg } of [
    { op: 'user_contour_data', name: 'contour', cfg: { w: 180, h: 120, stockAttach: 'cc', pathDatum: 'cc' } },
    { op: 'user_pocket_data', name: 'pocket', cfg: { w: 160, h: 100, stockAttach: 'cc', pathDatum: 'cc' } },
    { op: 'user_surfacing_data', name: 'surfacing', cfg: { w: 150, h: 100, stockAttach: 'cc', pathDatum: 'cc' } },
    { op: 'user_drill_data', name: 'drill', cfg: { stockAttach: 'cc', pathDatum: 'cc' } },
    { op: 'user_bore_data', name: 'bore', cfg: { stockAttach: 'cc', pathDatum: 'cc' } },
    { op: 'user_slot_data', name: 'slot', cfg: { ax: 20, ay: 20, bx: 80, by: 40, originX: 40, originY: 30 } },
    { op: 'user_text_data', name: 'text', cfg: { stockAttach: 'cc', pathDatum: 'cc' } },
]) {
    test(`${name}: the placed previewGeometry coincides with the emit toolpath (centre within ε)`, async ({ page }) => {
        await openTwin(page, op, cfg);
        const m = await measure(page);
        expect(m.fcC, `${name}: previewGeometry drawn`).toBeTruthy();
        expect(m.trC, `${name}: emit toolpath present`).toBeTruthy();
        expect(Math.abs(m.fcC.x - m.trC.x), `${name}: centre X coincides (fc ${m.fcC.x.toFixed(1)} vs trace ${m.trC.x.toFixed(1)})`).toBeLessThan(4);
        expect(Math.abs(m.fcC.y - m.trC.y), `${name}: centre Y coincides (fc ${m.fcC.y.toFixed(1)} vs trace ${m.trC.y.toFixed(1)})`).toBeLessThan(4);
    });
}

// DEFAULT placement (no attach): the previewGeometry and the trace ALWAYS agreed here (shift 0) — assert the fix didn't
// perturb the default case (a regression guard: placed==raw when the shift is zero).
test('contour default: no shift → previewGeometry still coincides with the trace', async ({ page }) => {
    await openTwin(page, 'user_contour_data', { w: 120, h: 90, originX: 30, originY: 20 });
    const m = await measure(page);
    for (const k of ['minX', 'maxX', 'minY', 'maxY']) expect(Math.abs(m.fc[k] - m.tr[k]), `default ${k}: coincident`).toBeLessThan(1.0);
});

// The pos handle is PLACED (sits on the placed feature) and its drag writes originX/originY through the INVERSE-map.
test('contour cc/cc: dragging the placed pos handle writes originX/originY', async ({ page }) => {
    await openTwin(page, 'user_contour_data', { w: 180, h: 120, originX: 0, originY: 0, stockAttach: 'cc', pathDatum: 'cc' });
    const ox0 = await page.evaluate(() => Number(document.querySelector('#wiz_user_form [data-param="originX"]').value));
    const oy0 = await page.evaluate(() => Number(document.querySelector('#wiz_user_form [data-param="originY"]').value));
    const b = await page.locator('#wiz_user .fc-handle-move').first().boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2 + 30, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const ox1 = await page.evaluate(() => Number(document.querySelector('#wiz_user_form [data-param="originX"]').value));
    const oy1 = await page.evaluate(() => Number(document.querySelector('#wiz_user_form [data-param="originY"]').value));
    expect(ox1 !== ox0 || oy1 !== oy0, `the pos drag wrote originX/originY (${ox0},${oy0} → ${ox1},${oy1})`).toBeTruthy();
});
