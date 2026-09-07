import { test, expect } from './support/harness.mjs';

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
 *
 * t1512 (tier migration): SPLIT off browser→node. The 3 tests here call `handleTargetReport`/`formfieldBindings`
 * directly on constructed children arrays and assert on the plain returned report — no DOM, no registry state. The
 * 4th test ("an unresolved handle renders as an obviously-broken marker...") opens a real wizard, waits on a real
 * canvas SVG, and takes a screenshot — stayed in handle-target-fails-visibly-2525-drive.spec.js.
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

test('t2665 (gap 9): ONE formfield with a dangling Assign-Var matchvar must not blank the OTHER, perfectly valid formfield\'s handle target', async ({ page }) => {
    // Root cause: deriveBindings (dataOps/deriveBindings.js) throws on the FIRST spec in a batch that fails to
    // match exactly one block. The old formfieldBindings (userOps.js) wrapped the WHOLE batch in one try/catch,
    // so that single throw discarded every OTHER spec's already-valid binding too -- not bind-mode-specific (an
    // Op Param spec with a bad atomType/key hits the same collapse), but it FIRST surfaced live via an
    // Assign-Var formfield whose matchvar was left at its own field default ('#1') instead of being retargeted.
    // A handle naming the STILL-VALID sibling param must resolve; only the one naming the actually-broken param
    // should come back unresolved -- the "2 handle fields declared, 0 matched" blanket refusal is the regression.
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const children = [
            { type: 'assign', params: { var: '#101', value: '0', note: '' } },
            { type: 'param_group', params: { group: 'g1' }, children: [
                { type: 'formfield', params: { param: 'px', type: 'number', bindMode: 'assign', matchvar: '#101', key: 'value', label: 'X' } },
                // py's matchvar never retargeted off the block's own default -- no assign block anywhere declares '#1'.
                { type: 'formfield', params: { param: 'py', type: 'number', bindMode: 'assign', matchvar: '#1', key: 'value', label: 'Y' } },
            ] },
            { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
                { type: 'point_handle', params: { fx: 'px', fy: 'py', ax: '0', ay: '0', label: 'pos' } },
            ] },
        ];
        return { report: U.handleTargetReport(children), pxBindings: U.formfieldBindings(children) };
    });
    expect(r.report.total, 'two handle-declared targets (fx=px, fy=py)').toBe(2);
    expect(r.report.matched, 'px is fully valid and must resolve despite py\'s dangling sibling spec').toBe(1);
    expect(r.report.unresolved).toEqual([{ param: 'py', kind: 'point' }]);
    expect(r.pxBindings.map((b) => b.param)).toEqual(['px']);
});
