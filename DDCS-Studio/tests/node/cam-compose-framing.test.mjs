import { test, expect } from './support/harness.mjs';

// Framing-normalization: composeParts turns N self-contained generator bodies (each ending in M30 + reusing N1/N2/N8/N9…)
// into ONE executable program — strips the terminal program-end from every part EXCEPT the last, and uniquifies labels per
// part so a GOTO in part 2 can't resolve to part 1's label. Without it, the controller STOPPED after part 1 (the shipped
// multi-op + sub-stack bug: only op 1 ran). REAL-symptom checks: exactly one terminal end, no intermediate M30, no duplicate
// N-labels across parts, BOTH parts' motion present + reachable (part 2 not orphaned).
//
// NODE-TIER CONVERSION: every test is pure (page.evaluate imports + returns data, plain expect() on it) — moved
// whole, no behavioural change.

const N_DEFS = (body) => (body.match(/^\s*N(\d+)\b/gm) || []).map((s) => Number(s.trim().slice(1)));
// t1077 — count PROGRAM TERMINATORS only (a bare M30 on its own line). An ERROR branch now carries its own declared
// halt `M30   ( stop - <why> )` so a fault can never fall through into the next composed part; that halt is NOT a
// terminator of the success path, so it must not be counted here. The invariant these tests guard is unchanged:
// exactly ONE terminal end, and none in the middle of the SUCCESS flow.
const M30S = (body) => (body.match(/^\s*M30\s*$/gm) || []).length;

test('framing: composeParts(corner + surfacing) — strip non-terminal M30, uniquify labels, one terminal end, both reachable', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { surfacingSlot } = await import('/data/millToSlot.js');
        const { cornerSlot } = await import('/data/probeToSlot.js');
        const { composeParts } = await import('/data/slotPack.js');
        const used = new Set();
        const a = cornerSlot(used, 0);                 // probe: labels {1,2,10,11,20,21,30}, ends M30
        a.fields.forEach((f) => used.add(f.idx));
        const b = surfacingSlot(used, a.fields.length);   // mill: labels {7,8,9}, ends M30
        const composed = composeParts([a.body, b.body]);
        // reference: the raw join (the OLD broken behavior) for contrast
        const rawJoin = [a.body, b.body].join('\n\n');
        return { composed, rawJoinM30: (rawJoin.match(/^\s*M30\s*$/gm) || []).length,
            cornerSig: composed.indexOf(';corner found'), surfSig: composed.indexOf(';raster row count') };
    });

    // exactly ONE terminal M30 (surfacing's, the last part) — the corner's M30 was STRIPPED (raw join had TWO → part 2 orphaned)
    expect(r.rawJoinM30, 'the raw join had 2 M30s (the bug: controller stops after part 1)').toBe(2);
    expect(M30S(r.composed), 'composed = exactly one terminal M30').toBe(1);
    // that one M30 is at the very end (after both parts) — nothing runs after it
    expect(r.composed.trimEnd().endsWith('M30'), 'the single M30 is the LAST line').toBe(true);

    // no intermediate M30: the M30 index is AFTER both parts' motion (part 2 is reachable, not dead code)
    // t1077 — locate the TERMINAL end (a bare M30 on its own line). A non-terminal part's error branch now carries its
    // own declared halt `M30   ( stop - <why> )`, which appears EARLIER in the body and is not the program terminator.
    const m30at = r.composed.search(/^\s*M30\s*$/m);
    expect(r.cornerSig, 'part 1 (corner) motion present').toBeGreaterThan(-1);
    expect(r.surfSig, 'part 2 (surfacing) motion present').toBeGreaterThan(-1);
    expect(r.cornerSig, 'corner before surfacing (order preserved)').toBeLessThan(r.surfSig);
    expect(r.surfSig, 'the surfacing (part 2) runs BEFORE the terminal M30 → reachable').toBeLessThan(m30at);

    // NO duplicate N-labels across parts: every N-label definition is unique (corner {1,2,10,11,20,21,30} + surfacing shifted)
    const defs = N_DEFS(r.composed);
    expect(defs.length, 'labels exist').toBeGreaterThan(3);
    expect(new Set(defs).size, 'no N-label number is defined twice (uniquified per part)').toBe(defs.length);

    // every GOTO target resolves to a defined label (no dangling jump after renumber). \s* matches BOTH the space-form
    // (generators: `GOTO 2`) and the Expert no-space form (`GOTO2`).
    const gotos = (r.composed.match(/\bGOTO\s*(\d+)\b/g) || []).map((s) => Number(s.replace(/\bGOTO\s*/, '')));
    const defSet = new Set(defs);
    gotos.forEach((g) => expect(defSet.has(g), `GOTO ${g} resolves to a defined N${g}`).toBe(true));
});

test('framing: composeParts(surfacing + drill) — the dispatch example; the fragment drill part stays reachable', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { surfacingSlot } = await import('/data/millToSlot.js');
        const { slotFromOp } = await import('/data/opToSlot.js');
        const { composeParts } = await import('/data/slotPack.js');
        const used = new Set();
        const a = surfacingSlot(used, 0);              // mill: ends M30
        a.fields.forEach((f) => used.add(f.idx));
        const b = slotFromOp('drill', 'circle', used, a.fields.length);   // fragment: ends M5, no M30
        const composed = composeParts([a.body, b.body]);
        return { composed, surfSig: composed.indexOf(';raster row count'),
            drillTail: b.body.trimEnd().split('\n').pop().trim(),
            drillTailAt: composed.indexOf('M5', composed.indexOf(';raster row count')) };
    });
    // surfacing's M30 stripped (drill follows); drill has no M30 → the composed body has ZERO M30 (the wrapper appends one M99)
    expect(M30S(r.composed), 'no intermediate M30 (surfacing part is not last → its M30 stripped)').toBe(0);
    // both parts present + in order; the drill (part 2) content comes AFTER the surfacing (reachable)
    expect(r.surfSig, 'surfacing present').toBeGreaterThan(-1);
    expect(r.drillTailAt, 'the drill (part 2) runs after the surfacing → reachable').toBeGreaterThan(r.surfSig);
});

test('framing: composeParts uniquifies the Expert NO-SPACE GOTO<n> form (def + ref renumber in lockstep — no cross-part collision)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { composeParts } = await import('/data/slotPack.js');
        // The DDCS Expert dialect emits GOTO with NO space (GOTO1) + bare-number labels (N1) — flow/saferetract atoms. Two
        // parts both reusing label 1 MUST end up with distinct bands, with each part's GOTO renumbered in lockstep with its N.
        const partA = 'IF #50>0 GOTO1\n#100=1\nGOTO1\nN1\n#1505=1';
        const partB = 'IF #60>0 GOTO1\n#101=1\nGOTO1\nN1\n#1505=1\nM30';
        const composed = composeParts([partA, partB]);
        const defs = (composed.match(/^N(\d+)\b/gm) || []).map((s) => Number(s.slice(1)));
        const gotos = (composed.match(/\bGOTO\s*(\d+)\b/g) || []).map((s) => Number(s.replace(/\bGOTO\s*/, '')));
        return { composed, defs, gotos };
    });
    // no duplicate N-def across the two parts (partB renumbered off partA's band)
    expect(new Set(r.defs).size, 'no duplicate N-def after uniquify').toBe(r.defs.length);
    // EVERY GOTO (no-space form included) resolves to a defined label — the def+ref moved together
    const defSet = new Set(r.defs);
    r.gotos.forEach((g) => expect(defSet.has(g), `GOTO${g} resolves to a defined N${g}`).toBe(true));
    // partB's GOTOs were renumbered OFF label 1 (else the no-space GOTO1 would jump backward into partA's N1)
    expect(r.gotos.filter((g) => g === 1).length, 'only partA targets label 1; partB renumbered').toBe(2);
    // the no-space form is preserved (not rewritten to a spaced form)
    expect(r.composed, 'no-space GOTO preserved').toMatch(/GOTO\d/);
});

test('framing: sub-stack subStackToSlot(opunit surfacing + custom) — the surfacing M30 is gone, the custom part reachable', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { getUserDef, registerUserOp, defVOf, flattenBlocks } = await import('/blocks/userOps.js');
        const { subStackToSlot } = await import('/data/subStackToSlot.js');
        // the node harness never runs web/app.js's seedDefaultPortedUserOps(), which seeds this twin in a real boot
        if (!getUserDef('user_surfacing_data')) {
            const { surfacingDataDef } = await import('/blocks/dataOps/surfacingData.js');
            registerUserOp(surfacingDataDef());
        }
        const surfDef = getUserDef('user_surfacing_data');
        const feedBlk = { type: 'feed', params: { rate: 300 } };
        const moveBlk = { type: 'move', params: { mode: 'cut', z: -2 } };
        const target = { opType: 'user_frame_target', template: [{ type: 'user_root', params: {}, children: [
            { type: 'opunit', params: { opType: 'user_surfacing_data', defV: defVOf('user_surfacing_data') }, children: surfDef.template[0].children },
            feedBlk, moveBlk,
        ] }], bindings: [] };
        const flat = flattenBlocks(target.template);
        target.bindings = [
            { param: 'cfeed', blockIndex: flat.indexOf(feedBlk), key: 'rate', label: 'Cut feed', type: 'number', default: 300 },
            { param: 'cz', blockIndex: flat.indexOf(moveBlk), key: 'z', label: 'Plunge Z', type: 'number', default: -2 },
        ];
        const slot = subStackToSlot(target);
        const czVar = (slot.fields.find((f) => f.key === 'cz') || {}).var;
        return { body: slot.body, surfAt: slot.body.indexOf(';raster row count'), czAt: czVar ? slot.body.indexOf('Z' + czVar) : -1 };
    });
    // the surfacing sub-unit is part 1 (a custom part follows) → its M30 is stripped → the custom move is reachable
    expect(M30S(r.body), 'no intermediate M30 in the composed sub-stack body').toBe(0);
    expect(r.surfAt, 'surfacing present').toBeGreaterThan(-1);
    expect(r.czAt, 'the custom plunge Z (part 2) present').toBeGreaterThan(-1);
    expect(r.surfAt, 'surfacing before the custom move — and no M30 between them (reachable)').toBeLessThan(r.czAt);
});
