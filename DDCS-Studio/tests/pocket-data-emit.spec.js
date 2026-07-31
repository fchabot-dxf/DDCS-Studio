import { test, expect } from '@playwright/test';

/**
 * POCKET E1 EMIT — the user_pocket_data twin emits BYTE-IDENTICAL to the built-in pocketStack across the FULL sweep:
 * strategy × tooSmall (BOTH derived states — a BIG pocket → the STEPOVER arm, a TOO-SMALL pocket → the DRILL-PLUNGE arm)
 * × 4 shapes × scalar. The twin is a SUPERSET (guards) + the derive-guards hook injects `_tooSmall` (geometry-derived) so
 * the tooSmall guard prunes to the right arm; postInstantiate rewrites the drill centre. INDEPENDENT truth = pocketStack
 * (a separate code path). Also asserts the tooSmall derive SELECTS the right arm + cross-dialect byte-identity.
 */
test('user_pocket_data == built-in pocketStack, byte-identical across strategy × tooSmall × 4 shapes × scalar', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const build = builderOf('user_pocket_data');
        if (!build) return { registered: false };

        const SHAPES = ['rect', 'circle', 'polygon', 'ellipse'], STRAT = ['spiral', 'raster'];
        // t1444 — `equal` JOINS THE SWEEP because the ruling SPLIT what `tiny` used to cover. A pocket strictly
        // smaller than its tool now REFUSES (no motion), so `tiny` no longer reaches the centre-plunge arm at all —
        // and the assertion below that the derive-hook selects that arm would have had to be deleted to go green.
        // Deleting it would have retired live coverage of a shipping arm to make a red test pass. The arm still
        // exists, for EXACTLY tool-sized pockets, so the sweep now contains one instead: 4mm refuses, 6mm plunges,
        // 80x60 clears, and all three assertions keep meaning what they say.
        const SIZES = { normal: { w: 80, h: 60, dia: 50 }, equal: { w: 6, h: 6, dia: 6 }, tiny: { w: 4, h: 4, dia: 4 } };
        const SCALARS = [
            {}, { toolDia: 10, stepoverPct: 55 }, { depth: 9, stepdown: 2 }, { wallOffset: 1.5 },
            { originX: 12, originY: -8, feed: 800, plunge: 120, clearance: 3 }, { wcs: 'G55', sides: 5 },
        ];
        const hasType = (stack, t) => JSON.stringify(stack).includes(`"type":"${t}"`);
        let diffs = 0, cases = 0, first = null, drillArm = 0, stepArm = 0, armWrong = 0, refuseArm = 0;
        for (const shape of SHAPES) for (const strategy of STRAT) for (const sz of Object.keys(SIZES)) for (let si = 0; si < SCALARS.length; si++) {
            // t945 — seed the live machine Head so the reference pocketStack (via makeStart) spins up like the data-op does at
            // build (spindleHeadPatch) → the M3 header is byte-matched (params.spindle is inert for the data builder itself).
            const p = { shape, strategy, ...SIZES[sz], ...SCALARS[si], spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };
            cases++;
            const twinStack = build(p);
            const twin = emitMapped(twinStack).text;
            const builtin = emitMapped(pocketStack(p)).text;
            if (twin !== builtin) { diffs++; if (!first) first = { p, twin: twin.slice(0, 1400), builtin: builtin.slice(0, 1400) }; }
            // The derive-hook must select the arm: tooSmall → the HOLE block, big → a pocketfill block (assert the SELECTION).
            //
            // t1391 — this counted a `drill` block, and the too-small arm now builds `holecycle` (the tenant moved out so
            // the literal atom could retire). DIAGNOSED BEFORE RESTATING, because twin==builder byte-identity is a LIVE
            // product property and a lag would be a FIX: the sweep reported **96 cases, 0 diffs** with only this counter
            // reading zero. So the product is sound and the counter was looking for a retired name.
            const isTiny = sz === 'tiny';
            const hasDrill = hasType(twinStack, 'holecycle'), hasFill = hasType(twinStack, 'pocketfill');
            if (hasDrill && !hasFill) drillArm++; else if (hasFill && !hasDrill) stepArm++;
            if (/#1505=1/.test(twin)) refuseArm++;   // t1444 — the third arm: strictly smaller than the tool, no motion
            // the ARM must match the built-in's arm (independent: does the built-in emit a drill or a stepover for this p?)
            const biDrill = hasType(pocketStack(p), 'holecycle');
            if (hasDrill !== biDrill) armWrong++;
        }
        return { registered: true, diffs, cases, first, drillArm, stepArm, armWrong, refuseArm };
    });
    expect(r.registered, 'user_pocket_data is seeded/registered on boot').toBe(true);
    if (r.first) console.log('POCKET DIFF @ ' + JSON.stringify(r.first.p) + '\n--TWIN--\n' + r.first.twin + '\n--BUILTIN--\n' + r.first.builtin);
    console.log('POCKET E1: ' + JSON.stringify({ cases: r.cases, diffs: r.diffs, drillArm: r.drillArm, stepArm: r.stepArm, refuseArm: r.refuseArm, armWrong: r.armWrong }));
    expect(r.cases, '4 shapes x 2 strategy x 3 sizes x 6 scalars').toBe(144);
    expect(r.drillArm, 'the derive-hook still selects the PLUNGE arm — now for EXACTLY tool-sized pockets (t1444 split it from refuse)').toBeGreaterThan(0);
    expect(r.refuseArm, '…and the REFUSAL arm for the ones strictly smaller than the tool').toBeGreaterThan(0);
    expect(r.stepArm, 'the STEPOVER arm for big pockets').toBeGreaterThan(0);
    expect(r.armWrong, 'the twin selects the SAME arm as the built-in for every case (the tooSmall derive is correct)').toBe(0);
    expect(r.diffs, 'the twin emit is BYTE-IDENTICAL to pocketStack across the full sweep (byte-diff ZERO)').toBe(0);
});

test('cross-dialect: user_pocket_data == pocketStack under grbl + rs274ngc (byte-identical)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { resolveActivePost } = await import('/wizards/dialects/index.js');
        const build = builderOf('user_pocket_data');
        const sweep = [
            { shape: 'rect', strategy: 'raster', w: 80, h: 60, wcs: 'G55' },
            { shape: 'circle', strategy: 'spiral', dia: 50 },
            { shape: 'rect', strategy: 'spiral', w: 4, h: 4 },   // tooSmall → drill
        ];
        let diffs = 0, first = null;
        for (const dialect of ['grbl', 'rs274ngc']) {
            const post = resolveActivePost ? resolveActivePost(dialect) : dialect;
            for (const p of sweep) {
                const twin = emitMapped(build(p), post).text;
                // t945 — the data-op inherits the Head at build; seed the same live Head into the reference pocketStack so the M3 header matches.
                const builtin = emitMapped(pocketStack({ ...p, spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} }), post).text;
                if (twin !== builtin) { diffs++; if (!first) first = { dialect, p, twin: twin.slice(0, 800), builtin: builtin.slice(0, 800) }; }
            }
        }
        return { diffs, first };
    });
    if (r.first) console.log('XDIALECT DIFF ' + JSON.stringify(r.first.dialect) + ' @ ' + JSON.stringify(r.first.p) + '\n--TWIN--\n' + r.first.twin + '\n--BUILTIN--\n' + r.first.builtin);
    expect(r.diffs, 'cross-dialect byte-identical (grbl + rs274ngc)').toBe(0);
});
