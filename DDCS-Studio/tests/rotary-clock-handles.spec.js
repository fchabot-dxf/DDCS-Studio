import { test, expect } from '@playwright/test';

/**
 * t530 — ROTARY CLOCK gets 2 DRAGGABLE probe-point handles (Option 1: KEEP the #6 span field, ADD the handles). Marker A =
 * the start position; marker B = A + span, and dragging B does a RELATIVE-SPAN write (B.y − A.y → #6). ADDITIVE: the #6
 * field AND the drag are two editors of the ONE source. VERIFY (real app): 2 draggable handles; drag B → #6 field + emit +
 * marker B follow; typing #6 still drives marker B; emit byte-identical for the defaults.
 */
test.use({ viewport: { width: 1400, height: 1000 } });
test('2 draggable handles (A + B); dragging B sets the #6 span; typing #6 drives B (one source, additive)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => {
        const SP = await import('/ui/settingsPanel.js');
        SP.applySettings({ stock: { x: 200, y: 120, z: 30, shape: 'box', show: true }, machine: { x: 300, y: 300, z: -120, show: true, workOrigin: { x: 0, y: 0, z: 0 } } });
    });
    await page.evaluate(() => window.openWiz('user_rotary_clock_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => document.querySelectorAll('#userViz3dContainer [data-hid^="__simstart"]').length >= 2 || document.querySelectorAll('#userVizContainer [data-hid^="__simstart"]').length >= 2, null, { timeout: 8000 });
    await page.waitForTimeout(300);

    // BOTH probe points render as draggable Layout handles (A + B) + the #6 span field is present
    const cont = (await page.locator('#userVizContainer [data-hid="__simstart0"]').count()) ? '#userVizContainer' : '#userViz3dContainer';
    const setup = await page.evaluate((sel) => {
        const { rotaryClockDataDef } = window.__rcdef || {};
        const hids = [...document.querySelectorAll(`${sel} [data-hid^="__simstart"]`)].map((e) => e.getAttribute('data-hid'));
        return { hids: hids.sort(), hasSpanField: !!document.querySelector('#wiz_user_form [data-param="span"]') };
    }, cont);
    expect(setup.hids, 'both A and B render as draggable Layout handles').toEqual(['__simstart0', '__simstart1']);
    expect(setup.hasSpanField, 'the #6 span field STAYS (precise numeric input — one source, additive)').toBe(true);

    // DRAG handle B upward (screen −Y = world +Y = a larger span). It writes #6 = B.y − A.y.
    const cbox = await page.locator(cont).boundingBox();
    const hbB = await page.locator(`${cont} [data-hid="__simstart1"]`).first().boundingBox();
    await page.mouse.move(hbB.x + hbB.width / 2, hbB.y + hbB.height / 2);
    await page.mouse.down();
    await page.mouse.move(hbB.x + hbB.width / 2, cbox.y + 40, { steps: 18 });   // toward the top → world +Y → span grows
    await page.mouse.up();
    await page.waitForTimeout(250);

    const afterDrag = await page.evaluate(async () => {
        const { getLastOp } = await import('/blocks/opRecord.js');
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const o = getLastOp();
        const starts = opSimStarts('user_rotary_clock_data', o.params, window.ddcsGetSettings().stock) || [];
        const emit = emitMapped(builderOf('user_rotary_clock_data')(o.params)).text;
        const m6 = (emit.match(/#6\s*=\s*([\d.]+)/) || [])[1];
        return { span: o.params.span, aY: starts[0] && starts[0].y, bY: starts[1] && starts[1].y, emit6: m6 };
    });
    console.log('after B-drag: span=' + afterDrag.span + ' A.y=' + afterDrag.aY + ' B.y=' + afterDrag.bY + ' emit #6=' + afterDrag.emit6);
    expect(Number(afterDrag.span), 'dragging B UP grew the #6 span past the default 20').toBeGreaterThan(20);
    expect(Math.abs((afterDrag.bY - afterDrag.aY) - Number(afterDrag.span)), 'marker B = marker A + span (B tracks A + #6)').toBeLessThan(0.5);
    expect(Math.abs(Number(afterDrag.emit6) - Number(afterDrag.span)), 'the emitted #6 == the dragged span (the drag wrote the field)').toBeLessThan(0.001);

    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'scratchpad/rotary_clock_2handles.png', clip: _b }); }   // t712 clip capture (rAF-starvation dodge)
    // TYPING #6 still drives marker B (the field is the same one source) — set span=15, B moves to A + 15
    await page.evaluate(() => { const f = document.querySelector('#wiz_user_form [data-param="span"]'); f.value = '15'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(250);
    const afterType = await page.evaluate(async () => {
        const { getLastOp } = await import('/blocks/opRecord.js');
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const s = opSimStarts('user_rotary_clock_data', getLastOp().params, window.ddcsGetSettings().stock) || [];
        return { span: getLastOp().params.span, dY: (s[1] && s[0]) ? (s[1].y - s[0].y) : null };
    });
    console.log('after typing #6=15: span=' + afterType.span + ' B−A=' + afterType.dY);
    expect(Number(afterType.span), 'typing the #6 field sets the span').toBe(15);
    expect(Math.abs(afterType.dY - 15), 'marker B follows the TYPED span (B = A + 15) — the field drives B too').toBeLessThan(0.5);
});
