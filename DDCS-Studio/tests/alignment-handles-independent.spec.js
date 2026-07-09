import { test, expect } from '@playwright/test';

/**
 * ALIGNMENT (+ rotary clock) handle INDEPENDENCE (t570) — a principle the human has enforced across every wizard: dragging
 * ONE handle must NEVER move another. Alignment's B = A + span, so dragging A used to CARRY B. Fix: dragging the ANCHOR (A)
 * recomputes the dependent SPAN so B's ABSOLUTE position stays PUT (span = B_abs − A_new); dragging B moves only B; typing the
 * span is the one deliberate B-moves direction. Verified by the real drag gesture on the 2D layout.
 */
test.use({ viewport: { width: 1300, height: 950 } });

async function openIn2D(page, op) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = { show: true, x: 150, y: 100, z: 25, datum: 'nnp' }; s.preview = s.preview || {}; s.preview.autoLoop = false; });
    await page.evaluate((op) => window.openWiz(op), op);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.evaluate(() => { const p = window.ddcsStudio.wizardManager._activePanel; if (p && p.setView) p.setView('2d'); });
    await page.waitForTimeout(500);
}
const handleCentre = (page, hid) => page.evaluate((hid) => {
    const el = document.querySelector(`#wiz_user svg [data-hid="${hid}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}, hid);

// The marker WORLD positions (robust to the view auto-panning while a handle drags) — the drag GRABS the screen handle but
// the assertions read the world markers.
const markerWorlds = (page) => page.evaluate(() => (window.ddcsStudio.wizardManager._activePanel.getPassStarts() || []).map((s) => ({ x: s.x, y: s.y })));
async function dragAndCheck(page, spanParam, dx, dy) {
    const wBefore = await markerWorlds(page);
    const aBefore = await handleCentre(page, '__simstart0');   // screen pos to GRAB the handle
    const spanBefore = await page.evaluate((p) => +document.querySelector(`#wiz_user_form [data-param="${p}"]`).value, spanParam);
    expect(aBefore, 'the A handle renders').not.toBeNull();
    expect(wBefore.length, 'A + B markers exist').toBeGreaterThanOrEqual(2);

    // DRAG A along the SPAN AXIS (the fence / touch line) — the meaningful gesture that used to rigidly carry B
    await page.mouse.move(aBefore.x, aBefore.y);
    await page.mouse.down();
    await page.mouse.move(aBefore.x + dx, aBefore.y + dy, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(400);

    const wAfter = await markerWorlds(page);
    const spanAfter = await page.evaluate((p) => +document.querySelector(`#wiz_user_form [data-param="${p}"]`).value, spanParam);
    // deltas in WORLD mm (A = marker 0, B = marker 1). `along` = the fence axis: B must HOLD along the fence (span recompute);
    // B's PERPENDICULAR may ride A's approach line (the confirmed constraint) — so we check B's ALONG-fence delta, not its total.
    return {
        aMoved: Math.hypot(wAfter[0].x - wBefore[0].x, wAfter[0].y - wBefore[0].y),
        bAlongHeld: (a) => Math.abs(wAfter[1][a] - wBefore[1][a]),
        spanBefore, spanAfter,
    };
}

// Alignment: the span runs along the checkAxis (X, screen-X) — drag A along it. Deltas are WORLD mm (robust to the auto-pan).
test('ALIGN: dragging A along the fence moves ONLY A — B stays put + the span field recomputes (no longer carried)', async ({ page }) => {
    await openIn2D(page, 'user_alignment_data');
    const r = await dragAndCheck(page, 'span', -40, 0);
    expect(r.aMoved, 'A actually moved (world mm)').toBeGreaterThan(3);
    expect(r.bAlongHeld('x'), 'B HELD its position ALONG the fence (X) — not carried by A').toBeLessThan(1);
    expect(Math.abs(r.spanAfter - r.spanBefore), 'the span field RECOMPUTED to hold B (B_abs − A_new)').toBeGreaterThan(1);
});

// Rotary clock: the span runs along Y (screen-Y) — drag A along it.
test('ROTARY CLOCK: dragging A along the touch line moves ONLY A — B stays put + the span recomputes (same contract)', async ({ page }) => {
    await openIn2D(page, 'user_rotary_clock_data');
    const r = await dragAndCheck(page, 'span', 0, 40);
    expect(r.aMoved, 'A actually moved (world mm)').toBeGreaterThan(3);
    expect(r.bAlongHeld('y'), 'B HELD its position ALONG the touch line (Y) — not carried by A').toBeLessThan(1);
    expect(Math.abs(r.spanAfter - r.spanBefore), 'the span field RECOMPUTED to hold B').toBeGreaterThan(1);
});
