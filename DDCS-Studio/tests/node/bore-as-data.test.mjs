import { test, expect } from './support/harness.mjs';

/**
 * BORE PORT — the data-op twin's emit is BYTE-IDENTICAL to the built-in bore (drillStack with method='helical'). INDEPENDENT
 * TRUTH: drillStack is a separate path. Bore is the Drill wizard's helical variant → a `bore` leaf (holeDia/toolDia/pitch/ramp),
 * NOT the peck `drill` leaf, so it needs its OWN twin. VERIFY byte-diff ZERO across pattern × ramp (step/helix — incl. the
 * linearized-helix hazard) × cut × placement × wcs, on the default (Expert) dialect + a cross-dialect spot-check.
 *
 * t2691 — TIER MIGRATION BATCH 3: moved browser→node. No twin-seeding fix needed: this file already calls
 * `registerUserOp(boreDataDef())` explicitly in-test.
 */
test('byte-diff ZERO: user_bore_data == drillStack(helical) across pattern × ramp × cut × placement × wcs', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { boreDataDef, BORE_DEFAULTS } = await import('/blocks/dataOps/boreData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { drillStack } = await import('/wizards/drillWizard.js');
        registerUserOp(boreDataDef());
        const build = builderOf('user_bore_data');
        // t945 — the data-op inherits the machine Head at BUILD (spindleHeadPatch), like the FORM path at insert; seed the SAME
        // live Head so the reference drillStack (via makeStart) spins up identically → the M3 header is not a spurious diff.
        const D = { ...BORE_DEFAULTS, spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };

        const combos = [
            D,
            { ...D, ramp: 'helix' },                                              // the linearized-helix path (many G1 chords)
            { ...D, pattern: 'circle', dia: 60, count: 5, startAngle: 30 },
            { ...D, pattern: 'line', count: 4, spacing: 25, angle: 15 },
            { ...D, pattern: 'rect', w: 90, h: 70, nx: 3, ny: 3 },
            { ...D, holeDia: 20, toolDia: 8, depth: 12, pitch: 1, feed: 150 },     // cut sweep (Ø ≥ tool)
            { ...D, ramp: 'helix', holeDia: 18, toolDia: 6, depth: 9, pitch: 0.8 },
            { ...D, holeDia: 6, toolDia: 6, depth: 5 },                            // hole ≤ tool → straight plunge fallback
            { ...D, x0: 25, y0: 15, skip: '2' },                                   // off-origin + skip
            { ...D, wcs: 'G55', stockAttach: 'cc', stockW: 200, stockH: 150 },     // placement / wcs
        ];
        let diffs = 0, first = null;
        const lineDiff = (twin, builtin, p) => { const tl = twin.split('\n'), bl = builtin.split('\n'); let li = 0; while (li < tl.length && li < bl.length && tl[li] === bl[li]) li++; return { p, line: li, twinCtx: tl.slice(Math.max(0, li - 1), li + 2), builtinCtx: bl.slice(Math.max(0, li - 1), li + 2) }; };
        for (const p of combos) {
            const twin = emitMapped(build(p)).text, builtin = emitMapped(drillStack(p)).text;
            if (twin !== builtin) { diffs++; if (!first) first = lineDiff(twin, builtin, { ramp: p.ramp, pattern: p.pattern, holeDia: p.holeDia }); }
        }
        // cross-dialect spot-check
        // BACKLOG #30 — was grbl+rs274ngc only, ZERO V4.1/DM500 coverage: the data path can branch per dialect
        // through postInstantiate and cap-gating, so "same stack" never implied "same text on the DDCS posts
        // specifically" — added, not assumed clean.
        let dialectDiffs = 0;
        for (const profileId of ['grbl', 'rs274ngc', 'ddcs-v41', 'ddcs-v3-dm500']) for (const p of [D, { ...D, ramp: 'helix' }]) {
            if (emitMapped(build(p), { profileId }).text !== emitMapped(drillStack(p), { profileId }).text) dialectDiffs++;
        }
        // WIRING — a sentinel cut param lands in the merged hole block (holeDia → the bore-radius entry, r=(holeDia-toolDia)/2).
        // t1385: WAS `/G0 X44\b/`, a fully BAKED entry coordinate. The switch walks the pattern at runtime, so the hole's
        // XY is `origin + register`: the radius is still baked (it is build-time geometry) but it is now a TERM in an
        // expression — `G0 X[44 + #75] Y[0 + #76]`. The wiring claim is unchanged (the 44 must be there and must be the
        // bore entry); only its spelling is, so the pattern matches the radius INSIDE the expression it now sits in.
        const wire = /G0 X\[44 \+ #\d+\]/.test(emitMapped(build({ ...D, pattern: 'grid', cols: 1, rows: 1, x0: 0, y0: 0, holeDia: 94, toolDia: 6 })).text);   // r=(94-6)/2=44
        return { comboCount: combos.length, diffs, first, dialectDiffs, wire, registered: !!build };
    });
    expect(r.registered, 'user_bore_data registered').toBe(true);
    if (r.first) console.log('BORE DIFF @ ' + JSON.stringify(r.first.p) + ' line ' + r.first.line + '\n--TWIN--\n' + (r.first.twinCtx || []).join('\n') + '\n--BUILTIN--\n' + (r.first.builtinCtx || []).join('\n'));
    expect(r.diffs, 'byte-diff ZERO across pattern × ramp × cut × placement × wcs').toBe(0);
    expect(r.dialectDiffs, 'byte-diff ZERO cross-dialect (grbl + rs274ngc + V4.1 + DM500)').toBe(0);
    expect(r.wire, 'WIRING: holeDia=94 tool=6 → bore radius 44 lands (t1385: as a term in G0 X[44 + #reg])').toBe(true);
});
