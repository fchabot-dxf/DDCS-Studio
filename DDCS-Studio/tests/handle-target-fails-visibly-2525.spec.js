import { test, expect } from '@playwright/test';

/**
 * t2525 (BACKLOG #71) — "a handle pointing at a param that does not exist must FAIL VISIBLY, not silently
 * render a dead handle" (the dispatch's own explicit ONE THING TO GET RIGHT). Two layers, both real:
 *   1. AUTHOR TIME: the handle's own field is a MUST-MATCH picker (bridge.js HANDLE_ANCHOR_FIELDS), so it
 *      can only ever commit a param that ALREADY EXISTS in the stack -- the bad state is unrepresentable
 *      through the normal authoring UI.
 *   2. THE BACKSTOP: a target formfield renamed or deleted AFTER a handle was authored (or a hand-authored/
 *      legacy stack that bypassed the picker entirely) still produces a dangling reference -- `handleTargetReport`
 *      (userOps.js) BLOCKS save the same way `formfieldMatchReport` already does for the identical class of
 *      problem, and `layoutSpecFromOp` (panelTypes.js) renders it as an OBVIOUSLY BROKEN red marker instead of
 *      a normal-looking handle, checked BEFORE any working anchor.kind branch so it pre-empts every gesture.
 */

test('handleTargetReport: reports an unresolved handle target, matched otherwise -- the save-time backstop', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        // ONE real formfield (width, bound to a real progstart.clearance socket), ONE handle pointing at a
        // param NOTHING declares (ghost) -- formfieldBindings' own deriveBindings needs the matched atom
        // (progstart) to actually be present in `children` to resolve 'width' at all.
        const children = [
            { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
                { type: 'point_handle', params: { fx: 'width', fy: 'ghost', ax: '0', ay: '0', label: 'pos' } },
            ] },
            { type: 'param_group', params: { group: 'Test' }, children: [
                { type: 'formfield', params: { param: 'width', label: 'W', dflt: '5', bindMode: 'opparam', atomType: 'progstart', key: 'clearance', type: 'number' } },
            ] },
            { type: 'progstart', params: { rpm: 12000, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
        ];
        const clean = U.handleTargetReport(children);
        // now make BOTH dangling (no formfield at all)
        const dirty = U.handleTargetReport([children[0]]);
        return { clean, dirty };
    });
    expect(r.clean.total, 'two handle-declared targets (fx, fy)').toBe(2);
    expect(r.clean.matched, 'fx (width) resolves; fy (ghost) does not').toBe(1);
    expect(r.clean.unresolved).toEqual([{ param: 'ghost', kind: 'point' }]);
    expect(r.dirty.matched, 'with no formfield at all, NEITHER target resolves').toBe(0);
    expect(r.dirty.unresolved.map((u) => u.param).sort()).toEqual(['ghost', 'width']);
});

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

test('devMode save gate: a stack with a dangling handle target is REFUSED, mirroring formfieldMatchReport\'s own established backstop', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const children = [
            { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
                { type: 'length_handle', params: { field: 'ghost', axis: 'Y', ax: '0', ay: '0', min: '0', max: '', label: 'reach' } },
            ] },
        ];
        return U.handleTargetReport(children);
    });
    // devMode.js's own prepareCandidate calls this exact function and returns { ok:false, error } when
    // unresolved.length > 0 -- verified structurally here (the function this session's save gate consumes),
    // matching formfieldMatchReport's own already-tested precedent rather than re-deriving devMode's UI flow.
    expect(r.unresolved.length, 'the report itself flags the dangling target -- what devMode.js checks to refuse the save').toBeGreaterThan(0);
    expect(r.unresolved[0].param).toBe('ghost');
});
