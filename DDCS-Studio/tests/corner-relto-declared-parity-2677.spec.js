import { test, expect } from '@playwright/test';

/**
 * t2677 (Phase 2 board, proposal (c)) — PROVING THE MECHANISM, corner as the proving ground, NOT migrated.
 *
 * point_handle's own new `relToRow` field + panelTypes.js's `resolveRelToPoint` (the ONE implementation the
 * role-tagged fallback branch and the DECLARED `anchor.kind==='point'` branch now both call) must render
 * corner's own `reposition` gesture IDENTICALLY whichever path builds `def.bindings` — the live, real
 * `cornerDataDef()` (group/role baked onto the value-binding specs, the fallback branch) vs a SCRATCH def
 * built the declared way (group/role stripped from the value bindings, a `point_handle` block with
 * `relToRow:'wall1'` merged on via `handleBindingsFromStack`/`mergeHandleAnchors` instead — exactly what a
 * real corner migration would eventually do, proposals (a)/(b) permitting). `cornerData.js` itself is
 * UNTOUCHED by this file — the scratch def is built here, in the test, not shipped.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

/** Build the scratch def: same value bindings as the real corner def, `group`/`role` stripped off cross1_x/y
 *  (those come from the point_handle block's own merge instead), a synthetic template carrying ONE
 *  `point_handle` block (`fx:'cross1_x', fy:'cross1_y', relToRow:'wall1'`) inside a `feature_canvas` mouth. */
async function buildScratchDef(page) {
    return page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const { cornerDataDef } = await import('/blocks/dataOps/cornerData.js');
        const realDef = cornerDataDef();
        const strippedBindings = realDef.bindings.map((b) => {
            if (b.param === 'cross1_x' || b.param === 'cross1_y') { const { group, role, ...rest } = b; return rest; }
            return b;
        });
        const scratchTemplate = [{ type: 'feature_canvas', params: {}, children: [
            { type: 'point_handle', params: { fx: 'cross1_x', fy: 'cross1_y', relToRow: 'wall1' } },
        ] }];
        const handleAnchors = U.handleBindingsFromStack(scratchTemplate, strippedBindings);
        // non-vacuity guard, inline: the point_handle's own declared targets must actually resolve — a
        // silent [] here would make every comparison below pass VACUOUSLY (both sides find nothing).
        if (handleAnchors.some((h) => h.anchorUnresolved)) throw new Error('scratch def: point_handle target unresolved — ' + JSON.stringify(handleAnchors));
        const scratchBindings = U.mergeHandleAnchors(strippedBindings, handleAnchors);
        return { opType: realDef.opType, simStartsProvider: null, bindings: scratchBindings };
    });
}

test('relToRow-declared point_handle renders the reposition handle IDENTICALLY to the live role-tagged fallback — position, both corner/probeSeq combos', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
    // scratchDef.simStartsProvider can't cross the page.evaluate boundary as a function reference — register the
    // real corner def first (so its provider is LIVE/registered under CORNER_DATA_OPTYPE, which resolveRelToIndex
    // reads via the registry, not via def.simStartsProvider directly) exactly like every other corner test does.
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const CD = await import('/blocks/dataOps/cornerData.js');
        localStorage.removeItem('ddcs_user_ops');
        U.createUserOp(CD.cornerDataDef());
    });

    const r = await page.evaluate(async () => {
        const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
        const { cornerDataDef, CORNER_DEFAULTS } = await import('/blocks/dataOps/cornerData.js');
        const U = await import('/blocks/userOps.js');
        const realDef = cornerDataDef();
        const strippedBindings = realDef.bindings.map((b) => {
            if (b.param === 'cross1_x' || b.param === 'cross1_y') { const { group, role, ...rest } = b; return rest; }
            return b;
        });
        const scratchTemplate = [{ type: 'feature_canvas', params: {}, children: [
            { type: 'point_handle', params: { fx: 'cross1_x', fy: 'cross1_y', relToRow: 'wall1' } },
        ] }];
        const handleAnchors = U.handleBindingsFromStack(scratchTemplate, strippedBindings);
        if (handleAnchors.some((h) => h.anchorUnresolved)) throw new Error('scratch def: point_handle target unresolved — ' + JSON.stringify(handleAnchors));
        const scratchBindings = U.mergeHandleAnchors(strippedBindings, handleAnchors);
        const scratchDef = { ...realDef, bindings: scratchBindings };   // opType/simStartsProvider inherited — resolveRelToIndex/opSimStarts key off opType, already registered above

        const S = (o) => ({ ...CORNER_DEFAULTS, ...o, travelDist: 50 });
        const repOf = (def, params) => (layoutSpecFromOp(def, params).handles || []).find((h) => h.kind === 'move') || null;
        const pack = (o) => { const p = S(o); return { real: repOf(realDef, p), scratch: repOf(scratchDef, p) }; };
        return { fl: pack({ corner: 'FL', probeSeq: 'YX' }), br: pack({ corner: 'BR', probeSeq: 'XY' }) };
    });
    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

    for (const combo of ['fl', 'br']) {
        const { real, scratch } = r[combo];
        expect(real, `${combo}: real fallback handle exists`).toBeTruthy();
        expect(scratch, `${combo}: scratch declared-path handle exists`).toBeTruthy();
        // INDEPENDENT TRUTH first (mirrors corner-data-repos-handle.spec.js's own hand-derived check): FL/YX →
        // wall2 (-43,7); BR/XY → wall2 (93,123) — both paths must ALSO match the known-correct value, not just
        // each other (two wrongs rendering the same wrong number would pass a same-vs-same check vacuously).
        const near = (a, b, t = 0.02) => Math.abs(a - b) < t;
        const truth = combo === 'fl' ? { x: -43, y: 7 } : { x: 93, y: 123 };
        expect(near(real.x, truth.x) && near(real.y, truth.y), `${combo}: real matches the independent truth (${truth.x},${truth.y}), got (${real.x},${real.y})`).toBe(true);
        expect(near(scratch.x, truth.x) && near(scratch.y, truth.y), `${combo}: scratch matches the independent truth (${truth.x},${truth.y}), got (${scratch.x},${scratch.y})`).toBe(true);
        // then cross-path parity, exactly. (ax/ay/fx/fy are consumed by canvasWidgets.js's own `place()` and
        // do not survive into the final handle object — only the COMBINED world x/y does; confirmed live via
        // canvasWidgets.js's own `point.place: (d) => ({ x: (d.ax||0)+d.x, y: (d.ay||0)+d.y, ... })`.)
        expect(scratch.x, `${combo}: x identical between the two paths`).toBeCloseTo(real.x, 6);
        expect(scratch.y, `${combo}: y identical between the two paths`).toBeCloseTo(real.y, 6);
        expect(scratch.label, `${combo}: label identical (the pass number, not the block's own default 'pos')`).toBe(real.label);
        expect(scratch.color, `${combo}: color identical (source-coloured, t81)`).toBe(real.color);
        expect(!!scratch.manual, `${combo}: manual identical`).toBe(!!real.manual);
        expect(scratch.emits, `${combo}: emits identical (t1684 census finding 2)`).toBe(real.emits);
    }
});

test('relToRow-declared point_handle relocates to the RUNTIME wall-1 END (dog-leg) IDENTICALLY to the fallback, when passEnds is threaded', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const CD = await import('/blocks/dataOps/cornerData.js');
        localStorage.removeItem('ddcs_user_ops');
        U.createUserOp(CD.cornerDataDef());
    });

    const r = await page.evaluate(async () => {
        const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
        const { cornerDataDef, CORNER_DEFAULTS, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
        const { opSimStarts } = await import('/viz/opSimStarts.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const U = await import('/blocks/userOps.js');
        const realDef = cornerDataDef();
        const strippedBindings = realDef.bindings.map((b) => {
            if (b.param === 'cross1_x' || b.param === 'cross1_y') { const { group, role, ...rest } = b; return rest; }
            return b;
        });
        const scratchTemplate = [{ type: 'feature_canvas', params: {}, children: [
            { type: 'point_handle', params: { fx: 'cross1_x', fy: 'cross1_y', relToRow: 'wall1' } },
        ] }];
        const handleAnchors = U.handleBindingsFromStack(scratchTemplate, strippedBindings);
        if (handleAnchors.some((h) => h.anchorUnresolved)) throw new Error('scratch def: point_handle target unresolved');
        const scratchDef = { ...realDef, bindings: U.mergeHandleAnchors(strippedBindings, handleAnchors) };

        const s = window.ddcsGetSettings().stock;
        const p = { ...CORNER_DEFAULTS, travelDist: 50 };
        const tstock = { x: s.x, y: s.y, z: s.z, shape: s.shape, show: true };
        const declared = realDef.simStartsProvider(p, tstock).map((m) => ({ x: m.x, y: m.y, z: m.z || 0, source: m.source, anchorsAtPrev: !!m.anchorsAtPrev }));
        const gcode = emitMapped(builderOf(CORNER_DATA_OPTYPE)(p)).text;
        const passEnds = traceToolpath(gcode, { stock: tstock, start: declared[0], passStarts: declared }).passEnds || [];

        const repOf = (def, params, pe) => (layoutSpecFromOp(def, params, null, null, pe).handles || []).find((h) => h.kind === 'move') || null;
        return {
            realStatic: repOf(realDef, p, undefined), realFaithful: repOf(realDef, p, passEnds),
            scratchStatic: repOf(scratchDef, p, undefined), scratchFaithful: repOf(scratchDef, p, passEnds),
        };
    });
    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

    const near = (a, b, t = 0.05) => Math.abs(a - b) < t;
    expect(near(r.scratchFaithful.x, r.realFaithful.x) && near(r.scratchFaithful.y, r.realFaithful.y), `dog-leg-shifted position identical: real (${r.realFaithful.x},${r.realFaithful.y}) vs scratch (${r.scratchFaithful.x},${r.scratchFaithful.y})`).toBe(true);
    // the REGRESSION guard both paths must independently pass (mirrors corner-data-repos-handle.spec.js's own
    // second test): the dog-leg-shifted position is DISTINCT from the static one — the relocation actually fired.
    expect(Math.hypot(r.realFaithful.x - r.realStatic.x, r.realFaithful.y - r.realStatic.y), 'real: faithful is relocated away from static').toBeGreaterThan(20);
    expect(Math.hypot(r.scratchFaithful.x - r.scratchStatic.x, r.scratchFaithful.y - r.scratchStatic.y), 'scratch: faithful is relocated away from static').toBeGreaterThan(20);
    expect(near(r.scratchStatic.x, r.realStatic.x) && near(r.scratchStatic.y, r.realStatic.y), 'no-passEnds static position also identical between the two paths').toBe(true);
});

test('relToRow-declared point_handle: the pinned-wall write-back computes the SAME value to write as the fallback (direct panelStarts injection, bypassing the spot-store)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const CD = await import('/blocks/dataOps/cornerData.js');
        localStorage.removeItem('ddcs_user_ops');
        U.createUserOp(CD.cornerDataDef());
    });

    const r = await page.evaluate(async () => {
        const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
        const { cornerDataDef, CORNER_DEFAULTS, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
        const { opSimStarts, resolveRelToIndex } = await import('/viz/opSimStarts.js');
        const U = await import('/blocks/userOps.js');
        const realDef = cornerDataDef();
        const strippedBindings = realDef.bindings.map((b) => {
            if (b.param === 'cross1_x' || b.param === 'cross1_y') { const { group, role, ...rest } = b; return rest; }
            return b;
        });
        const scratchTemplate = [{ type: 'feature_canvas', params: {}, children: [
            { type: 'point_handle', params: { fx: 'cross1_x', fy: 'cross1_y', relToRow: 'wall1' } },
        ] }];
        const handleAnchors = U.handleBindingsFromStack(scratchTemplate, strippedBindings);
        if (handleAnchors.some((h) => h.anchorUnresolved)) throw new Error('scratch def: point_handle target unresolved');
        const scratchDef = { ...realDef, bindings: U.mergeHandleAnchors(strippedBindings, handleAnchors) };

        const s = window.ddcsGetSettings().stock;
        const p = { ...CORNER_DEFAULTS, corner: 'FL', probeSeq: 'YX' };
        const stock = { w: s.x, h: s.y };
        const wall1Idx = resolveRelToIndex(CORNER_DATA_OPTYPE, p, { row: 'wall1' });
        const marks = opSimStarts(CORNER_DATA_OPTYPE, p, s) || [];
        const destPass = wall1Idx + 1;
        // a FAKE panelStarts: same marker world as the real chain, but the DESTINATION pass forced pinned to a
        // DIFFERENT world point than the current cross1_x/y default would produce — so the write-back has a
        // real delta to compute, not a no-op (the destPinned guard skips a write that wouldn't change anything).
        const panelStarts = marks.map((m, i) => (i === destPass ? { ...m, x: m.x + 3, y: m.y - 2, pinned: true } : { ...m }));

        // layoutSpecFromOp's own _writeParam is private (no direct spy); read the RESOLVED world x/y the
        // handle renders at instead — under a pinned destination that world position IS what got derived
        // from (and would write back into) cross1_x/cross1_y, per resolveRelToPoint's own contract.
        const writesOf = (def, params, ps) => {
            const spec = layoutSpecFromOp(def, params, null, null, null, null, null, ps);
            const h = (spec.handles || []).find((hh) => hh.kind === 'move');
            return h ? { x: h.x, y: h.y } : null;
        };
        return { real: writesOf(realDef, p, panelStarts), scratch: writesOf(scratchDef, p, panelStarts) };
    });
    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

    expect(r.real, 'real handle resolves under a pinned destination').toBeTruthy();
    expect(r.scratch, 'scratch handle resolves under a pinned destination').toBeTruthy();
    expect(r.scratch.x, 'world x identical under the pinned destination').toBeCloseTo(r.real.x, 6);
    expect(r.scratch.y, 'world y identical under the pinned destination').toBeCloseTo(r.real.y, 6);
});
