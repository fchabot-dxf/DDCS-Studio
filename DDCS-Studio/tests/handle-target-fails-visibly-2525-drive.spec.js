import { test, expect } from '@playwright/test';

/**
 * t2525 (BACKLOG #71) — "a handle pointing at a param that does not exist must FAIL VISIBLY, not silently
 * render a dead handle". See tests/node/handle-target-fails-visibly-2525.test.mjs for the pure `handleTargetReport`/
 * `formfieldBindings` model coverage.
 *
 * t1512 (tier migration): this is the one test of the four that opens a real wizard, waits on a real canvas SVG,
 * and takes a screenshot — it stayed here because the node tier's structural-only document stub can't answer a
 * real querySelector/waitForSelector.
 */

test('an unresolved handle renders as an obviously-broken marker (red, no value, no drag effect) -- never silently absent or silently inert', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 100, y: 80, z: 20, shape: 'box', show: true } }); });
    const OPTYPE = 'user_broken_pilot';
    const r = await page.evaluate(async (t) => {
        const U = await import('/blocks/userOps.js');
        localStorage.removeItem('ddcs_user_ops');
        try { U.deleteUserOp(t); } catch (_) {}
        // length_handle names 'ghost' -- NO formfield anywhere declares it
        const template = [{
            type: 'user_root', params: {},
            uiChildren: [
                { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
                    { type: 'length_handle', params: { field: 'ghost', axis: 'Y', ax: '3', ay: '4', min: '0', max: '', label: 'reach' } },
                ] },
            ],
            children: [
                { type: 'progstart', params: { rpm: 12000, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
                { type: 'progend', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' } },
            ],
        }];
        U.createUserOp(U.userOpFromStack(t, 'Broken Pilot', template, [], 'form2d'));
        const def = U.listUserOps().find((d) => d.opType === t);
        const params = U.defaultParams(def);
        const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
        const spec = layoutSpecFromOp(def, params, null, null, null, {}, () => {}, null);
        const broken = (spec.handles || []).find((h) => /_broken$/.test(h.id));
        const normalLength = (spec.handles || []).find((h) => h.kind === 'size' && !/_broken$/.test(h.id));
        const anchorEntry = (def.bindings || []).find((b) => b.anchor);
        // the drag/onEdit contract itself: 'broken' gesture never writes anything
        const { CANVAS_GESTURES } = await import('/viz/canvasWidgets.js');
        const dragResult = CANVAS_GESTURES.broken.drag({}, { x: 99, y: 99 });
        return {
            hasBroken: !!broken, brokenColor: broken && broken.color, brokenValue: broken && broken.value, brokenLabel: broken && broken.label,
            hasNormalHandle: !!normalLength,   // must be ABSENT -- an unresolved target never ALSO renders as if it worked
            anchorUnresolved: anchorEntry && anchorEntry.anchorUnresolved,
            dragResult,
        };
    }, OPTYPE);
    expect(r.anchorUnresolved, 'def.bindings carries the unresolved flag, never silently dropped').toBe(true);
    expect(r.hasBroken, 'a broken marker renders on the canvas -- never silently absent').toBe(true);
    expect(r.brokenColor, 'coloured red, visually distinct from every normal handle').toBe('#ef4444');
    expect(r.brokenLabel, 'names the missing param so a real author can find and fix it').toContain('ghost');
    expect(r.brokenValue, 'no editable numeric value shown -- never looks like a normal, functioning handle').toBeUndefined();
    expect(r.hasNormalHandle, 'the normal length-gesture handle never renders for an unresolved target -- never silently inert-but-present').toBe(false);
    expect(r.dragResult, "the 'broken' gesture's own drag contract: never writes anything, however it's grabbed").toBeNull();

    // visual confirmation, matching this session's own screenshot convention: open the SAME op for real and
    // capture the red marker as it actually renders, not just the programmatic decl shape asserted above.
    // t2527 -- waits on the CANVAS, not #wiz_user_form: this pilot has no real formfield at all (only the
    // broken handle), and #wiz_user_form's own row-skip fix (renderOpForm) now correctly leaves it EMPTY (zero
    // rows, zero height) for a wizard with no resolved params -- Playwright's own `state:'visible'` requires a
    // non-empty box, so it would time out on a container that's legitimately, correctly blank. The visualization
    // pane is what this test actually needs anyway (it's what gets screenshotted).
    await page.evaluate((t) => window.openWiz(t), OPTYPE);
    await page.waitForSelector('#userVizContainer svg', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
    { const _b = await page.locator('#wiz_user').boundingBox(); if (_b) await page.screenshot({ path: 'verification/t2525-broken-handle-fails-visibly.png', clip: _b }); }
    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, OPTYPE);
});
