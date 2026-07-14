import { test, expect } from '@playwright/test';

/**
 * t716 — THE MILL LAYOUT COMPLETENESS PASS. Every mill twin gets per-feature 2D handles via previewGeometry (drill/bore/
 * pocket/surfacing added here; slot/contour/text at t708/t712). Each declared feature dimension is a draggable handle that
 * writes its param; the layout FRAMES stock+feature+start together. Handles are preview-side → emit byte-identical.
 */
test.use({ viewport: { width: 1300, height: 980 } });

async function openTwin(page, opType, seedPattern) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz, null, { timeout: 15000 });
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 200, y: 150, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; });
    await page.evaluate((t) => window.openWiz(t), opType);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
    // t848 — the drill/bore DEFAULT is now a single hole (no size handle); to exercise a size-handle drag, seed a pattern.
    if (seedPattern) {
        await page.evaluate((p) => { const f = document.querySelector('#wiz_user_form [data-param="pattern"]'); if (f) { f.value = p; f.dispatchEvent(new Event('change', { bubbles: true })); f.dispatchEvent(new Event('input', { bubbles: true })); } }, seedPattern);
        await page.waitForTimeout(500);
    }
}
const layoutState = (page) => page.evaluate(() => ({
    paths: document.querySelectorAll('#wiz_user .fc-path, #wiz_user .fc-guide').length,
    handles: document.querySelectorAll('#wiz_user .fc-handle').length,
    move: document.querySelectorAll('#wiz_user .fc-handle-move').length,
}));
const paramVal = (page, name) => page.evaluate((n) => { const f = document.querySelector(`#wiz_user_form [data-param="${n}"]`); return f ? f.value : null; }, name);
async function dragHandle(page, selector, dx, dy) {
    const b = await page.locator(selector).first().boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);
}

for (const { op, name, sizeParams, seedPattern } of [
    { op: 'user_surfacing_data', name: 'surfacing', sizeParams: ['w', 'h'] },
    { op: 'user_pocket_data', name: 'pocket', sizeParams: ['w', 'h'] },
    { op: 'user_drill_data', name: 'drill', sizeParams: ['dx', 'dy'], seedPattern: 'grid' },   // t848 — default is now single; seed grid to test the pitch size-handle
    { op: 'user_bore_data', name: 'bore', sizeParams: ['dx', 'dy'], seedPattern: 'grid' },
]) {
    test(`${name} twin: the 2D draws the feature + handles; a size-handle drag writes its param`, async ({ page }) => {
        await openTwin(page, op, seedPattern);
        const st = await layoutState(page);
        expect(st.paths, `${name}: the feature geometry is drawn`).toBeGreaterThanOrEqual(1);
        expect(st.handles, `${name}: pos + size handles present`).toBeGreaterThanOrEqual(2);
        expect(st.move, `${name}: a pos (move) handle`).toBeGreaterThanOrEqual(1);
        // drag the SIZE handle (the non-move .fc-handle) → its param changes
        const [pa, pb] = sizeParams;
        const a0 = await paramVal(page, pa), b0 = await paramVal(page, pb);
        const sizeSel = '#wiz_user .fc-handle:not(.fc-handle-move):not(.fc-handle-sim)';
        await dragHandle(page, sizeSel, 40, 35);
        const a1 = await paramVal(page, pa), b1 = await paramVal(page, pb);
        expect(a1 !== a0 || b1 !== b0, `${name}: dragging the size handle wrote ${pa}/${pb} (${a0},${b0} → ${a1},${b1})`).toBeTruthy();
        const _bb = await page.locator('#wiz_user').boundingBox();   // t710 convention: boundingBox+clip (idle-3D locator.screenshot stalls)
        if (_bb) await page.screenshot({ path: `scratchpad/mill-layout-${name}.png`, clip: _bb });
    });
}
