import { test, expect } from '@playwright/test';

/**
 * BACKLOG #61 (t2583, the t2571 assessment's own SECOND and last sized gesture) — the GUI CROSS-AIM-HANDLE
 * canvas block. `cross_aim_handle`, nested inside a `feature_canvas` block's own mouth, DECLARES a draggable
 * IN-AXIS TRAVERSE-TARGET handle: `field` is a MUST-MATCH picker (bridge.js HANDLE_ANCHOR_FIELDS) naming an
 * EXISTING param an "Op Param" `formfield` elsewhere in the stack already binds — same template as
 * `diag_aim_handle`'s own single-role cousins (radial/scale/shear), extended with the SAME two read-only
 * companion pickers `diag_aim_handle` proved (`axisField`/`signField`).
 *
 * THE GENUINE DIFFERENCE from `diag_aim_handle` (t2571's own assessment; this is its build — the harder half it
 * flagged): beyond diagAim's own two primitives (stock-relative span, enum-driven sign — both REUSED here
 * unchanged), canvasWidgets.js's own `crossAim` gesture needs `lineAt`, the LIVE world position of ANOTHER
 * declared pass along the PERPENDICULAR axis — t2571 traced this to the SAME `relTo` mechanism already wired
 * for `point`-kind handles (`resolveRelToIndex`+`panelStarts`), here EXTENDED to feed a non-point gesture. This
 * file's own third test is the one that proves that extension, not diagAim's own primitives a second time.
 *
 * VERIFY (assert-the-value): round-trip (all 3 pickers, resolved + unresolved) · gesture math (place/drag) in
 * isolation, an independent truth · the relTo extension resolving a REAL declared pass's live position through
 * `layoutSpecFromOp`, AND falling back to the stock-relative default when no live pass position is available ·
 * a real op's def.bindings merge the anchor; emit CHANGES for the numeric write AND both enum companions.
 */

const OPTYPE = 'user_ca_pilot';

test('round-trip: a cross_aim_handle nested in feature_canvas MERGES its anchor onto the ONE written binding, or fails visibly if either the written target OR a read-only companion is missing', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const fc = { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
            { type: 'cross_aim_handle', params: { field: 'cross', axisField: 'axisF', signField: 'signF', signPosValue: 'pos', signWhenPos: '1', relToRow: 'wall1', label: '↔' } },
        ] };
        const real = [
            { param: 'cross', type: 'number', match: { type: 'progstart' }, key: 'clearance', default: 50, blockIndex: 0 },
            { param: 'axisF', type: 'enum', match: { type: 'raw' }, key: 'text', default: 'X', blockIndex: 1 },
            { param: 'signF', type: 'enum', match: { type: 'message' }, key: 'text', default: 'pos', blockIndex: 2 },
        ];
        const anchors = U.handleBindingsFromStack([fc], real);
        const merged = U.mergeHandleAnchors(real, anchors);
        const back = U.handleBindingsToBlocks(merged);
        // no real binding named 'axisF'/'signF' -> the written entry fails visibly too (the companion doctrine)
        const unresolvedAnchors = U.handleBindingsFromStack([fc], real.slice(0, 1));
        return { anchors, merged, back0: back[0], nBack: back.length, unresolvedAnchors };
    });
    expect(r.anchors.length, 'one cross_aim_handle -> one anchor entry (role cross)').toBe(1);
    const a = r.anchors[0];
    expect(a.param).toBe('cross');
    expect(a.role).toBe('cross');
    expect(a.match, 'MERGED from the real binding, not socket-less').toEqual({ type: 'progstart' });
    expect(a.key).toBe('clearance');
    expect(a.anchor).toEqual({ kind: 'crossAim', axisField: 'axisF', signField: 'signF', signPosValue: 'pos', signWhenPos: 1, relToRow: 'wall1', label: '↔' });
    expect(r.merged.filter((b) => b.param === 'cross').length).toBe(1);
    // reverse round-trip
    expect(r.nBack).toBe(1);
    expect(r.back0.type).toBe('feature_canvas');
    expect(r.back0.children).toEqual([{ type: 'cross_aim_handle', params: { field: 'cross', axisField: 'axisF', signField: 'signF', signPosValue: 'pos', signWhenPos: '1', relToRow: 'wall1', label: '↔' } }]);
    // FAIL VISIBLY: axisF/signF don't resolve -> the written entry anchorUnresolved (the companion doctrine)
    expect(r.unresolvedAnchors.filter((x) => x.anchorUnresolved).length).toBe(1);
});

test('the CROSS-AIM gesture places at wallFace+sign*cross along the distance axis (riding lineAt on the perpendicular), and a drag re-derives cross (clamped >=1, assert the value not just moved)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => true);
    const r = await page.evaluate(async () => {
        const { CANVAS_GESTURES } = await import('/viz/canvasWidgets.js');
        const dX = { axisX: true, wallFace: 0, sign: 1, cross: 50, lineAt: 60, field: 'cross', label: '↔' };
        const placeX = CANVAS_GESTURES.crossAim.place(dX);                                // along = 0+1*50=50; axisX -> x=along, y=lineAt
        const dragX = CANVAS_GESTURES.crossAim.drag(dX, { x: 37.6, y: 999 });             // axisX -> reads w.x only: |37.6-0| rounds to 38
        const dragClamped = CANVAS_GESTURES.crossAim.drag(dX, { x: 0.2, y: 999 });        // |0.2-0| rounds to 0 -> clamped to 1 (min)
        const dY = { axisX: false, wallFace: 80, sign: -1, cross: 20, lineAt: 30, field: 'cross', label: '↔' };
        const placeY = CANVAS_GESTURES.crossAim.place(dY);                                // along = 80+(-1*20)=60; !axisX -> x=lineAt, y=along
        return { placeX, dragX, dragClamped, placeY };
    });
    expect(r.placeX, 'axisX -> x holds the distance-axis coord (wallFace+sign*cross), y holds lineAt (the perpendicular)').toEqual({ x: 50, y: 60, kind: 'size', label: '↔', value: 50 });
    expect(r.dragX.cross, 'axisX -> the field reads |world.x - wallFace|, rounded').toBe(38);
    expect(r.dragClamped.cross, 'cross never drops below 1, even for a near-wall drag').toBe(1);
    expect(r.placeY, '!axisX -> x holds lineAt, y holds the distance-axis coord').toEqual({ x: 30, y: 60, kind: 'size', label: '↔', value: 20 });
});

test('a cross-aim-handle op: relTo (relToRow) resolves lineAt to a REAL declared pass\'s live world position through layoutSpecFromOp — and falls back to the stock-relative default when no live pass position is available', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 100, y: 80, z: 20, shape: 'box', show: true } }); });
    const r = await page.evaluate(async (t) => {
        const U = await import('/blocks/userOps.js');
        const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        localStorage.removeItem('ddcs_user_ops');
        try { U.deleteUserOp(t); } catch (_) {}
        const template = [{
            type: 'user_root', params: {},
            uiChildren: [
                { type: 'feature_canvas', params: { panel: 'form2d' }, children: [
                    { type: 'cross_aim_handle', params: { field: 'cross', axisField: 'axisF', signField: 'signF', signPosValue: 'pos', signWhenPos: '1', relToRow: 'wall1', label: '↔' } },
                ] },
                // t2583 — id is not yet an author-facing simstart FIELD (a pre-existing gap, unrelated to this
                // turn's own build — relTo has only ever been reachable via formfield's own relToRow, never
                // authored the OTHER end before now); the underlying object model already supports it (read
                // directly by simStartsFromStack), so a literal template (as every non-UI-drive test here
                // builds) can still declare it, proving the mechanism itself, independent of that separate gap.
                { type: 'simstart', params: { anchor: 'frac', fx: '0', fy: '0.75', zplane: 'probe', id: 'wall1' } },
                { type: 'param_group', params: { group: 'Test' }, children: [
                    { type: 'formfield', params: { param: 'axisF', label: 'Axis', dflt: 'X', bindMode: 'opparam', atomType: 'raw', key: 'text', type: 'enum', widget: 'dropdown', options: 'X=X,Y=Y' } },
                    { type: 'formfield', params: { param: 'signF', label: 'Sign', dflt: 'pos', bindMode: 'opparam', atomType: 'message', key: 'text', type: 'enum', widget: 'dropdown', options: 'Positive=pos,Negative=neg' } },
                    { type: 'formfield', params: { param: 'cross', label: 'Cross', dflt: '50', bindMode: 'opparam', atomType: 'progstart', key: 'clearance', type: 'number' } },
                ] },
            ],
            children: [
                { type: 'progstart', params: { rpm: 12000, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
                { type: 'raw', params: { text: 'X' } },
                { type: 'message', params: { text: 'pos' } },
                { type: 'progend', params: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' } },
            ],
        }];
        U.createUserOp(U.userOpFromStack(t, 'CA Pilot', template, [], 'form2d'));
        const def = U.listUserOps().find((d) => d.opType === t);
        const params = U.defaultParams(def);
        const anchored = (def.bindings || []).filter((b) => b.anchor);

        // RESOLVED: a real declared pass ('wall1', frac fx=0/fy=0.75 -> world {x:0, y:60} on a 100x80 stock)
        // fed in as panelStarts (the same shape the live 3D-marker computation passes to this same argument).
        const panelStarts = opSimStarts(t, params, { x: 100, y: 80, z: 20 });
        const specResolved = layoutSpecFromOp(def, params, null, null, null, {}, () => {}, panelStarts);
        const hResolved = (specResolved.handles || []).find((x) => /_cross$/.test(x.id));

        // FALLBACK: panelStarts not yet available (null) -> lineAt falls back to the perpendicular stock half,
        // even though relToRow IS declared and registered -- the defensive Array.isArray(panelStarts) guard.
        const specFallback = layoutSpecFromOp(def, params, null, null, null, {}, () => {}, null);
        const hFallback = (specFallback.handles || []).find((x) => /_cross$/.test(x.id));

        const base = U.defaultParams(def);
        const emitDefault = (await import('/blocks/blockEmitter.js')).emitMapped((await import('/blocks/opBuilders.js')).builderOf(t)(base)).text;
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const emitAxis = emitMapped(builderOf(t)({ ...base, axisF: 'Y' })).text;
        const emitSign = emitMapped(builderOf(t)({ ...base, signF: 'neg' })).text;
        const emitCross = emitMapped(builderOf(t)({ ...base, cross: 77 })).text;

        try { U.deleteUserOp(t); } catch (_) {} localStorage.removeItem('ddcs_user_ops');
        return {
            anchorCount: anchored.length, anchorKind: anchored[0] && anchored[0].anchor.kind,
            hasResolved: !!hResolved, resolvedX: hResolved && hResolved.x, resolvedY: hResolved && hResolved.y,
            hasFallback: !!hFallback, fallbackX: hFallback && hFallback.x, fallbackY: hFallback && hFallback.y,
            axisChanges: emitDefault !== emitAxis, signChanges: emitDefault !== emitSign, crossChanges: emitDefault !== emitCross,
        };
    }, OPTYPE);
    expect(r.anchorCount, 'the one role-tagged binding (cross) carries the merged anchor').toBe(1);
    expect(r.anchorKind).toBe('crossAim');
    expect(r.hasResolved, 'layoutSpecFromOp renders a draggable cross-aim handle for the merged binding').toBe(true);
    // axisF dflt 'X' -> axisX=true; signF dflt 'pos' -> sign=+1 -> wallFace=0; cross dflt 50 -> along=0+50=50 -> x=50;
    // relTo 'wall1' resolves to the declared pass's live y (60) -> lineAt=60 -> y=60
    expect(r.resolvedX, 'x holds wallFace+sign*cross (0+1*50=50)').toBe(50);
    expect(r.resolvedY, 'relTo RESOLVES lineAt to the declared pass\'s own live perpendicular position (60), not the stock-half default (40)').toBe(60);
    // same op, panelStarts withheld -> lineAt falls back to the perpendicular stock HALF (stockHalfH=40 for axisX)
    expect(r.hasFallback, 'the handle still renders when panelStarts is unavailable').toBe(true);
    expect(r.fallbackX, 'x is unaffected by the lineAt fallback').toBe(50);
    expect(r.fallbackY, 'without a live pass position, lineAt falls back to the stock-relative default (stockHalfH=40)').toBe(40);
    expect(r.axisChanges, 'the axisField enum reaches emit (verbatim raw.text)').toBe(true);
    expect(r.signChanges, 'the signField enum reaches emit (verbatim message.text)').toBe(true);
    expect(r.crossChanges, 'cross reaches emit (progstart.clearance)').toBe(true);
});

// t2583 — SAME park, same reason, as diag_aim_handle's own fifth test (WORK-LOG t2575/t2579/t2581): the app-level
// `feature_canvas` flyout-drag failure at this stack depth is a GENERAL gesture-creation block (t2581's own
// finding — proven NOT specific to any one block type via a length_handle control), not something this gesture's
// own code can fix or work around differently than diag_aim_handle already tried. Per t2583's own dispatch
// ("if crossAim's UI proof hits the SAME blocker, do not fight it -- prove what you can through the real
// production code paths... and park the UI drive with the same reason"): parked without attempting a build, since
// diag_aim_handle's own pilot already exhausted the available API-workaround path for this exact blocker and
// t2581 already spent a full turn chasing its root cause under the advisor's own guardrail. cross_aim_handle's
// own correctness is independently proven by the three tests above, through the same production code paths
// (`layoutSpecFromOp`, `emitMapped`, `builderOf`) a real UI action would call.
test.skip('DRIVE THE APP, THE t2517/t2525 BAR: formfields + simstart placed FIRST, then feature_canvas + cross_aim_handle picking all three, real save, a REAL reload, then a REAL mouse drag on the rendered SVG handle changes the cross field and the emitted G-code — PARKED, blocked on the general gesture-creation failure t2581 found (not this gesture\'s own code)', async () => {});
