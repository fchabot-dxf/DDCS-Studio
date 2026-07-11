import { test, expect } from '@playwright/test';

/**
 * t716 — THE START-MARKER TRANSLATE RULE across the mill twins. The anchor (the translate handle for slot; the pos handle
 * for the origin-based ops — both the FIRST .fc-handle-move) TRANSLATES the whole setup: dragging it moves the feature while
 * every SHAPE param stays FROZEN (a 5in slot at 45° stays 5in/45°). The feature handles reshape INDEPENDENTLY (drag B → A
 * unmoved). All preview-side → emit byte-identical.
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
const val = (page, name) => page.evaluate((n) => { const f = document.querySelector(`#wiz_user_form [data-param="${n}"]`); return f ? Number(f.value) : null; }, name);
async function dragMove(page, index, dx, dy) {
    const b = await page.locator('#wiz_user .fc-handle-move').nth(index).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);
}

// For the origin-based ops the anchor is the pos handle (writes originX/originY); the SHAPE params must stay frozen.
for (const { op, name, moved, frozen } of [
    { op: 'user_contour_data', name: 'contour', moved: 'originX', frozen: ['w', 'h'] },
    { op: 'user_surfacing_data', name: 'surfacing', moved: 'originX', frozen: ['w', 'h'] },
    { op: 'user_pocket_data', name: 'pocket', moved: 'originX', frozen: ['w', 'h'] },
    { op: 'user_drill_data', name: 'drill', moved: 'originX', frozen: ['dx', 'dy', 'cols', 'rows'] },
    { op: 'user_bore_data', name: 'bore', moved: 'originX', frozen: ['dx', 'dy', 'holeDia'] },
    { op: 'user_text_data', name: 'text', moved: 'x', frozen: ['rotation', 'height', 'width'] },
]) {
    test(`${name}: dragging the anchor TRANSLATES (${moved} moves; shape params frozen)`, async ({ page }) => {
        await openTwin(page, op);
        const before = {}; for (const f of frozen) before[f] = await val(page, f);
        const m0 = await val(page, moved);
        await dragMove(page, 0, 45, 40);   // the anchor = the first move handle
        expect(await val(page, moved), `${name}: the anchor drag moved ${moved}`).not.toBe(m0);
        for (const f of frozen) expect(await val(page, f), `${name}: ${f} FROZEN on translate`).toBe(before[f]);
    });
}

// SLOT — the translate anchor moves A+B together (length + angle frozen); dragging B leaves A unmoved (independence).
test('slot: the anchor TRANSLATES (length + width + angle frozen); dragging B leaves A unmoved', async ({ page }) => {
    await openTwin(page, 'user_slot_data');
    const lenAng = async () => { const ax = await val(page, 'ax'), ay = await val(page, 'ay'), bx = await val(page, 'bx'), by = await val(page, 'by'); return { len: Math.hypot(bx - ax, by - ay), ang: Math.atan2(by - ay, bx - ax), ax, ay, bx, by }; };
    const w0 = await val(page, 'width'), a0 = await lenAng();
    await dragMove(page, 0, 50, 30);   // the FIRST move handle = the translate anchor
    const a1 = await lenAng();
    expect(a1.ax, 'the slot translated (A moved)').not.toBe(a0.ax);
    expect(Math.abs(a1.len - a0.len), 'the slot LENGTH is frozen on translate (5in stays 5in)').toBeLessThan(0.5);
    expect(Math.abs(a1.ang - a0.ang), 'the slot ANGLE is frozen on translate (45° stays 45°)').toBeLessThan(0.02);
    expect(await val(page, 'width'), 'the slot WIDTH is frozen on translate').toBe(w0);
    // independence: drag B (the LAST move handle: translate=0, A=1, B=2) → A stays put
    const nMove = await page.locator('#wiz_user .fc-handle-move').count();
    const ax2 = await val(page, 'ax'), ay2 = await val(page, 'ay');
    await dragMove(page, nMove - 1, 40, -30);
    expect(await val(page, 'bx') !== a1.bx || await val(page, 'by') !== a1.by, 'dragging B moved B').toBeTruthy();
    expect(await val(page, 'ax'), 'dragging B left A.x unmoved (independent)').toBe(ax2);
    expect(await val(page, 'ay'), 'dragging B left A.y unmoved (independent)').toBe(ay2);
    await page.locator('#wiz_user').screenshot({ path: 'scratchpad/mill-slot-translate.png' });
});
