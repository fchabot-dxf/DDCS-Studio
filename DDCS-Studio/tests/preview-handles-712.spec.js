import { test, expect } from '@playwright/test';

/**
 * t712 — SLOT + CONTOUR per-feature 2D handles via the DECLARED previewGeometry hook (twin-level). The twin's 2D layout
 * draws the real feature geometry (slot centreline+edges; contour boundary+offset toolpath) + draggable handles that
 * write the TWIN params (slot A/B/width; contour pos + shape size PER KIND — the multishape solved by declaration). A
 * drag → the form field → update → re-render (the writer round-trip). Handles are preview-side → emit byte-identical
 * (covered by slot-as-data / contour-data-emit). Contour's multishape: switching shape re-declares the right geometry.
 */
test.use({ viewport: { width: 1300, height: 980 } });

async function openTwin(page, opType) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; });
    await page.evaluate((t) => window.openWiz(t), opType);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
}
const layoutState = (page) => page.evaluate(() => ({
    paths: document.querySelectorAll('#wiz_user .fc-path, #wiz_user .fc-guide').length,
    move: document.querySelectorAll('#wiz_user .fc-handle-move').length,   // point (pos/A/B) handles = square 'move'
    handles: document.querySelectorAll('#wiz_user .fc-handle').length,     // all handles (incl. size circles)
}));
const paramVal = (page, name) => page.evaluate((n) => { const f = document.querySelector(`#wiz_user_form [data-param="${n}"]`); return f ? f.value : null; }, name);
const setEnum = (page, name, val) => page.evaluate(({ name, val }) => { const f = document.querySelector(`#wiz_user_form [data-param="${name}"]`); f.value = val; f.dispatchEvent(new Event('change', { bubbles: true })); f.dispatchEvent(new Event('input', { bubbles: true })); }, { name, val });
async function dragFirst(page, selector, dx, dy) {
    const b = await page.locator(selector).first().boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);
}

test('slot twin: the 2D draws the slot + A/B/width handles; dragging A writes ax/ay', async ({ page }) => {
    await openTwin(page, 'user_slot_data');
    const st = await layoutState(page);
    expect(st.paths, 'the slot geometry (centreline + edges) is drawn').toBeGreaterThanOrEqual(3);
    expect(st.move, 'A + B endpoint (move) handles').toBeGreaterThanOrEqual(2);
    expect(st.handles, 'A + B + width handles').toBeGreaterThanOrEqual(3);
    const ax0 = await paramVal(page, 'ax'), ay0 = await paramVal(page, 'ay');
    await dragFirst(page, '#wiz_user .fc-handle-move', 45, 40);   // drag the A endpoint
    const ax1 = await paramVal(page, 'ax'), ay1 = await paramVal(page, 'ay');
    expect(ax1 !== ax0 || ay1 !== ay0, `dragging A wrote ax/ay (${ax0},${ay0} → ${ax1},${ay1})`).toBeTruthy();
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/preview-handles-slot.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
});

test('contour twin: the 2D draws the shape + pos/size handles; dragging pos writes originX/originY', async ({ page }) => {
    await openTwin(page, 'user_contour_data');
    const st = await layoutState(page);
    expect(st.paths, 'the contour boundary + offset toolpath are drawn').toBeGreaterThanOrEqual(2);
    expect(st.move, 'a pos (move) handle').toBeGreaterThanOrEqual(1);
    expect(st.handles, 'pos + size handles').toBeGreaterThanOrEqual(2);
    const ox0 = await paramVal(page, 'originX'), oy0 = await paramVal(page, 'originY');
    await dragFirst(page, '#wiz_user .fc-handle-move', 40, 35);   // drag pos
    const ox1 = await paramVal(page, 'originX'), oy1 = await paramVal(page, 'originY');
    expect(ox1 !== ox0 || oy1 !== oy0, `dragging pos wrote originX/originY (${ox0},${oy0} → ${ox1},${oy1})`).toBeTruthy();
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/preview-handles-contour-rect.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
});

test('contour multishape: switching rect → circle re-declares the right geometry + handle (no guessing)', async ({ page }) => {
    await openTwin(page, 'user_contour_data');
    const rect = await page.evaluate(() => document.querySelectorAll('#wiz_user .fc-guide, #wiz_user .fc-path').length);
    expect(rect, 'rect boundary + offset drawn').toBeGreaterThanOrEqual(2);
    await setEnum(page, 'shape', 'circle');
    await page.waitForTimeout(300);
    const circle = await layoutState(page);
    expect(circle.paths, 'circle boundary + offset re-drawn from the region kernel').toBeGreaterThanOrEqual(2);
    expect(circle.handles, 'the circle keeps a pos + a Ø size handle').toBeGreaterThanOrEqual(2);
    // the boundary geometry actually changed shape: the circle ring is sampled to many more points than the rect's 4-5
    const ringPts = await page.evaluate(() => {
        const g = document.querySelector('#wiz_user .fc-guide');
        if (!g) return 0;
        return (g.getAttribute('d') || '').split(/[ML]/).filter((s) => s.trim()).length;
    });
    expect(ringPts, 'the circle boundary is a real sampled ring, not a 4-point rect').toBeGreaterThan(8);
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/preview-handles-contour-circle.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
});
