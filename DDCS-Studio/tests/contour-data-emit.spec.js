import { test, expect } from '@playwright/test';

/**
 * CONTOUR PORT E1 — the data-op twin's emit is BYTE-IDENTICAL to the built-in contourStack (the region-pill→flat reframe
 * + positional bindings). INDEPENDENT TRUTH: the built-in contourStack is a separate path. VERIFY byte-diff ZERO across
 * side (outside/inside/on) × the 4 shapes × a scalar/placement/wcs sweep, on the default (Expert) dialect + a cross-dialect
 * spot-check. (clearance is intentionally UNBOUND — the surfacing/drill frontier — so the sweep does not vary it.)
 */
test('E1 byte-diff ZERO: user_contour_data == contourStack across side × 4 shapes × a scalar/placement/wcs sweep', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { contourDataDef, CONTOUR_DEFAULTS } = await import('/blocks/dataOps/contourData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { contourStack } = await import('/wizards/contourWizard.js');
        registerUserOp(contourDataDef());   // NOT seeded yet in this test → register
        const build = builderOf('user_contour_data');
        // t945 — the data-op inherits the machine Head at BUILD (spindleHeadPatch), like the FORM path at insert; seed the SAME
        // live Head so the reference contourStack (via makeStart) spins up identically → the M3 header is not a spurious diff.
        const D = { ...CONTOUR_DEFAULTS, spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };

        const SIDES = ['outside', 'inside', 'on'], SHAPES = ['rect', 'circle', 'polygon', 'ellipse'];
        const combos = [];
        for (const side of SIDES) for (const shape of SHAPES) combos.push({ ...D, side, shape });
        // scalar / placement / wcs sweep
        combos.push(
            { ...D, side: 'outside', shape: 'rect', w: 50, h: 30, toolDia: 6, depth: 2, stepdown: 2 },
            { ...D, side: 'inside', shape: 'circle', dia: 40, toolDia: 8, feed: 300, plunge: 120 },
            { ...D, side: 'outside', shape: 'polygon', dia: 60, sides: 5, toolDia: 4 },
            { ...D, side: 'on', shape: 'ellipse', w: 90, h: 50, toolDia: 6 },
            { ...D, shape: 'rect', originX: 25, originY: 15, w: 40, h: 40 },              // placement offset
            { ...D, shape: 'rect', wcs: 'G55', depth: 6, stepdown: 1 },
            { ...D, shape: 'rect', stockAttach: 'cc', stockW: 200, stockH: 150, originX: 5 },   // stock-attach
        );

        let diffs = 0, first = null;
        const lineDiff = (twin, builtin, p) => {
            const tl = twin.split('\n'), bl = builtin.split('\n');
            let li = 0; while (li < tl.length && li < bl.length && tl[li] === bl[li]) li++;
            return { p, line: li, twinCtx: tl.slice(Math.max(0, li - 1), li + 2), builtinCtx: bl.slice(Math.max(0, li - 1), li + 2) };
        };
        for (const p of combos) {
            const twin = emitMapped(build(p)).text;
            const builtin = emitMapped(contourStack(p)).text;
            if (twin !== builtin) { diffs++; if (!first) first = lineDiff(twin, builtin, { side: p.side, shape: p.shape, originX: p.originX, wcs: p.wcs }); }
        }
        // cross-dialect spot-check (grbl + rs274) — the flatten must not diverge per dialect either
        let dialectDiffs = 0;
        for (const profileId of ['grbl', 'rs274ngc']) for (const p of [{ ...D, shape: 'rect', side: 'outside' }, { ...D, shape: 'circle', side: 'inside', dia: 40 }]) {
            if (emitMapped(build(p), { profileId }).text !== emitMapped(contourStack(p), { profileId }).text) dialectDiffs++;
        }
        // WIRING — sentinel scalars land
        const wireW = /X56\b/.test(emitMapped(build({ ...D, shape: 'rect', side: 'outside', w: 50, h: 30, toolDia: 6 })).text);   // 50 + 2·3 = 56
        return { comboCount: combos.length, diffs, first, dialectDiffs, wireW, registered: !!build };
    });
    expect(r.registered, 'user_contour_data registered').toBe(true);
    if (r.first) console.log('CONTOUR DIFF @ ' + JSON.stringify(r.first.p) + ' line ' + r.first.line + '\n--TWIN--\n' + (r.first.twinCtx || []).join('\n') + '\n--BUILTIN--\n' + (r.first.builtinCtx || []).join('\n'));
    expect(r.diffs, 'byte-diff ZERO across side × 4 shapes × the scalar/placement/wcs sweep').toBe(0);
    expect(r.dialectDiffs, 'byte-diff ZERO cross-dialect (grbl + rs274)').toBe(0);
    expect(r.wireW, 'WIRING: outside rect w=50 tool Ø6 grows to X56').toBe(true);
});
