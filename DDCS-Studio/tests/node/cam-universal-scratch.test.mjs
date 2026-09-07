import { test, expect } from './support/harness.mjs';

// t1085 S5(3) SLICE C — the UNIVERSAL arm. The generator arms emit hand-written macro text, so camScratch declares their
// scratch and slice B mints around it. The universal arm emits through emitMapped — the REAL atoms and the REAL active post
// — and both inject low macro vars of their own, so a universal slot's field vars (which start at #1) were landing on top
// of them at ONE part, before any composition. Slice C declares that scratch WHERE IT IS INJECTED (def.scratch on a palette
// atom, dialect.scratch on a post, PROBE_SURFACE_SCRATCH on the composer that has no def) and aggregates it in
// data/universalScratch.js, which stackToSlot passes as the avoid set.
//
// NODE-TIER CONVERSION: every test is pure (page.evaluate imports + returns data, plain expect() on it) — moved
// whole, no behavioural change. `waitForFunction(() => window.ddcsGetBlockProgram)` was a readiness gate in the
// browser boot; it is a no-op here and nothing in these test bodies calls that global.

test('S5(3)C — the injected band is READ from the injection sites, never re-declared in the aggregator', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const { PROBE_SURFACE_SCRATCH } = await import('/wizards/ops/probeSurface.js');
        const { opBands, dialectBands, universalBands } = await import('/data/universalScratch.js');
        const { dialect: expert } = await import('/wizards/dialects/ddcs-expert-m350.js');
        const { dialect: v41 } = await import('/wizards/dialects/ddcs-v41.js');
        const { dialect: grbl } = await import('/wizards/dialects/grbl.js');
        const covers = (bands, n) => bands.some(([lo, hi]) => n >= lo && n <= hi);
        return {
            // each number below is traced to the def/dialect that DECLARES it, so the aggregate cannot drift from the code
            declaredOn: {
                assign: BLOCKS.assign.scratch, asknumber: BLOCKS.asknumber.scratch, proberead: BLOCKS.proberead.scratch,
                readmachine: BLOCKS.readmachine.scratch, machinemove: BLOCKS.machinemove.scratch,
                radiuscomp: BLOCKS.radiuscomp.scratch, saferetract: BLOCKS.saferetract.scratch,
                safehop: BLOCKS.safehop.scratch, wcsbaseinto: BLOCKS.wcsbaseinto.scratch,
                corner_config: BLOCKS.corner_config && BLOCKS.corner_config.scratch, tooloffset: BLOCKS.tooloffset.scratch,
            },
            probeSurface: PROBE_SURFACE_SCRATCH,
            opCovers: [5, 6, 9, 10, 17, 22, 30, 31, 50, 57, 70, 95, 99, 100, 102].filter((n) => covers(opBands(), n)),
            // PER-POST, resolved from the dialect object itself — not hard-coded to Expert
            expert: [42, 43, 70, 71, 72, 150, 151, 152].filter((n) => covers(dialectBands(expert), n)),
            v41: [190, 191].filter((n) => covers(dialectBands(v41), n)),
            grblBands: dialectBands(grbl),
            expertWider: universalBands(expert).length > universalBands(grbl).length,
        };
    });
    // the declarations exist ON the atoms that inject them
    expect(r.declaredOn.assign, 'assign declares the #100 it writes').toEqual([[100, 100]]);
    expect(r.declaredOn.proberead, 'proberead declares #50').toEqual([[50, 50]]);
    expect(r.declaredOn.readmachine, 'readmachine declares #57').toEqual([[57, 57]]);
    expect(r.declaredOn.machinemove, 'machinemove declares the #99 staging var').toEqual([[99, 99]]);
    expect(r.declaredOn.saferetract, 'saferetract declares the #17 work clearance').toEqual([[17, 17]]);
    expect(r.declaredOn.safehop, 'safehop declares the #95 saved machine Z').toEqual([[95, 95]]);
    expect(r.declaredOn.corner_config, 'corner_config declares the #30/#31 it writes outright').toEqual([[30, 31]]);
    expect(r.probeSurface.length, 'the composer with no def declares its own band').toBeGreaterThan(0);
    // …and the aggregate covers every one of them
    expect(r.opCovers, 'the aggregate covers every atom-declared var').toEqual([5, 6, 9, 10, 17, 22, 30, 31, 50, 57, 70, 95, 99, 100, 102]);
    // PER-POST — the dialect contract did NOT have to change for every post: only the posts that inject declare
    expect(r.expert, 'Expert declares its own #42/#43, the #70-72 WCS family and #150-152').toEqual([42, 43, 70, 71, 72, 150, 151, 152]);
    expect(r.v41, 'V4.1 declares #190/#191').toEqual([190, 191]);
    expect(r.grblBands, 'a post that injects nothing declares nothing (optional key, like missScratch)').toEqual([]);
    expect(r.expertWider, 'so an Expert slot avoids strictly more than a grbl slot').toBe(true);
});

test('S5(3)C — a universal slot mints AROUND the injected band, and the small-op numbering is untouched', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { userOpFromStack } = await import('/blocks/userOps.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const { universalBands } = await import('/data/universalScratch.js');
        const mk = (n) => {
            const children = [{ type: 'feed', params: { rate: 200 } }];
            const bindings = [{ param: 'feed', blockIndex: 1, key: 'rate', type: 'number', default: 200, label: 'Feed', units: 'mm/min' }];
            for (let i = 0; i < n - 1; i++) {
                children.push({ type: 'move', params: { mode: 'cut', x: i, y: i * 2, z: -i, feed: 400 + i } });
                bindings.push({ param: 'z' + i, blockIndex: children.length, key: 'z', type: 'number', default: -i, label: 'Depth ' + i, units: 'mm' });
            }
            const def = userOpFromStack('u_n' + n, 'U ' + n, [{ type: 'user_root', params: {}, uiChildren: [], children }], bindings);
            const decl = {}; bindings.forEach((b) => { decl[b.param] = { exposed: true }; });
            return stackToSlot(def, decl, new Set(), 0);
        };
        const small = mk(4), big = mk(12);
        return {
            bands: universalBands(),
            smallVars: small.fields.map((f) => f.var),
            bigVars: big.fields.map((f) => f.var),
            bigIdx: big.fields.map((f) => f.idx),
            // every field var must be READ by the body it belongs to (the readLine) — proof the renumbering is consistent
            allRead: big.fields.every((f) => big.body.includes(f.var + '=#' + (f.idx + 1500))),
            lines: big.body.split('\n').length,
        };
    });
    const num = (v) => Number(String(v).replace('#', ''));
    const inB = (n) => r.bands.some(([lo, hi]) => n >= lo && n <= hi);
    // the SMALL case is byte-identical to the old numbering: #1-#4 sit below everything the emit path injects, so the
    // release note narrows the same way slice B did — only ops with enough exposed params to reach #5 renumber
    expect(r.smallVars, 'a 4-param universal op keeps #1-#4 (unchanged numbering)').toEqual(['#1', '#2', '#3', '#4']);
    // the BIG case steps over the injected vars
    expect(r.bigVars.filter((v) => inB(num(v))), 'no field var lands on anything the emit path injects').toEqual([]);
    /**
     * ── t1433 — THE SKIP LIST MOVED, BECAUSE A NEW ATOM DECLARED A LOW BAND ───────────────────────────────────────
     *
     * `wallfinish` (the rect pocket's parametric wall finish) declares `[[11, 14]]`, so the mint now steps over
     * #11-#14 as well and the 7th..12th field vars land at #15/#16/#18/#19/#20/#21 where they used to take
     * #11..#16. NOTHING IS BROKEN — this is the aggregator doing exactly its job, from a declaration made at the
     * injection site, and the invariant above (no field var lands in the band) is what actually guards the emit.
     * The literal list is re-pinned rather than relaxed to a predicate, because a list is what catches an accidental
     * WIDENING of the avoid set; the predicate alone would pass on a mint that skipped half the register file.
     *
     * ── THE COST, MEASURED, AND WHERE IT DOES AND DOES NOT BITE ───────────────────────────────────────────────────
     * The FIRST SIX field vars are unchanged (#1-#4, then #7/#8), so every universal op with six or fewer exposed
     * params renumbers by nothing at all — the same narrowing slice B's release note made. Only ops past six params
     * shift, and they shift UP by four.
     */
    expect(r.bigVars, 'it skips the declared numbers: #5/#6 probe port + tool radius, #9/#10 last retract, and t1433\'s #11-#14 wall band')
        .toEqual(['#1', '#2', '#3', '#4', '#7', '#8', '#15', '#16', '#18', '#19', '#20', '#21']);
    expect(r.bigVars.slice(0, 6), 'and the first SIX are unchanged — the cost bites only past six exposed params')
        .toEqual(['#1', '#2', '#3', '#4', '#7', '#8']);
    expect(r.bigIdx[0], 'the #11xx pool allocation is untouched by the renumbering').toBe(1100);
    expect(r.allRead, 'every renumbered var is read from its own #2600 mirror').toBe(true);
});

/**
 * ── THE AVOID SET IS GLOBAL, BY ARCHITECTURE — asserted so it cannot be quietly narrowed (t1433) ──────────────────
 *
 * THE QUESTION THIS ANSWERS: does a universal slot mint around `wallfinish`'s #11-#14 only when a wall body is
 * actually in the program (per-program, tight), or always (global, safe but over-broad)? It is GLOBAL, and it is
 * global on purpose — `opBands()` unions every palette atom's declaration, not the atoms present in one stack.
 *
 * THE REASON IS THE ONE t1085 slice C WROTE DOWN, and it still holds: a custom op's stack is USER-EDITABLE AFTER THE
 * SLOT IS MINTED. Mint per-stack and the numbering is correct only until somebody drops a Wall Finish block into the
 * op — at which point the wall body writes #11-#14 over four field vars, silently, in a slot that may already be
 * installed on the controller. Re-minting on edit does not save it: renumbering an installed slot's field vars moves
 * the pendant knobs an operator has already learned, and cannot reach a `macro_camN.nc` that was copied out weeks ago.
 * Wrong-by-omission here re-introduces exactly the defect slice C closed; wrong-by-over-avoidance costs four registers.
 *
 * SO THE TRADE IS ASSERTED RATHER THAN ASSUMED: the band is avoided for a stack that contains NO wall block at all.
 * That is the over-broad half of the decision, stated as a test, so narrowing it later is a deliberate act with this
 * comment in front of it rather than an optimisation that looks free.
 */
test('S5(3)C — the avoid set is GLOBAL: a stack with no wall block still mints around the wall band', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { opBands } = await import('/data/universalScratch.js');
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const { userOpFromStack } = await import('/blocks/userOps.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const covers = (bands, n) => bands.some(([lo, hi]) => n >= lo && n <= hi);
        // a 12-param op built from `feed` + `move` ONLY — neither declares any scratch, and no wall is anywhere near it
        const children = [{ type: 'feed', params: { rate: 200 } }];
        const bindings = [{ param: 'feed', blockIndex: 1, key: 'rate', type: 'number', default: 200, label: 'Feed', units: 'mm/min' }];
        for (let i = 0; i < 11; i++) {
            children.push({ type: 'move', params: { mode: 'cut', x: i, y: i * 2, z: -i, feed: 400 + i } });
            bindings.push({ param: 'z' + i, blockIndex: children.length, key: 'z', type: 'number', default: -i, label: 'D' + i, units: 'mm' });
        }
        const def = userOpFromStack('u_nowall', 'U NoWall', [{ type: 'user_root', params: {}, uiChildren: [], children }], bindings);
        const decl = {}; bindings.forEach((b) => { decl[b.param] = { exposed: true }; });
        const slot = stackToSlot(def, decl, new Set(), 0);
        return {
            declaresBand: BLOCKS.wallfinish.scratch,
            noScratchInStack: !BLOCKS.feed.scratch && !BLOCKS.move.scratch,
            aggregateCovers: [11, 12, 13, 14].filter((n) => covers(opBands(), n)),
            vars: slot.fields.map((f) => f.var),
        };
    });
    expect(r.declaresBand, 'the wall atom declares its band at the injection site').toEqual([[11, 14]]);
    expect(r.noScratchInStack, 'and the op under test is built from atoms that declare NO scratch at all').toBe(true);
    expect(r.aggregateCovers, 'yet the aggregate still covers #11-#14 — the union is over the PALETTE, not the stack').toEqual([11, 12, 13, 14]);
    expect(r.vars.some((v) => ['#11', '#12', '#13', '#14'].includes(v)), 'so a wall-free op still steps over the wall band').toBe(false);
});

test('S5(3)C — the guard now BACKSTOPS the universal arm too (silent on real output, loud on a synthetic collision)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { userOpFromStack } = await import('/blocks/userOps.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const { fieldVarCollisions, collisionMessage, bandsFor } = await import('/data/camScratch.js');
        const { universalBands } = await import('/data/universalScratch.js');
        // the SAME resolver macrosApp runs the guard with
        const camBandsOf = (t) => ((t === 'universal') ? universalBands() : bandsFor(t));

        const children = [{ type: 'feed', params: { rate: 200 } }];
        const bindings = [{ param: 'feed', blockIndex: 1, key: 'rate', type: 'number', default: 200, label: 'Feed', units: 'mm/min' }];
        for (let i = 0; i < 11; i++) {
            children.push({ type: 'move', params: { mode: 'cut', x: i, y: i * 2, z: -i, feed: 400 + i } });
            bindings.push({ param: 'z' + i, blockIndex: children.length, key: 'z', type: 'number', default: -i, label: 'Depth ' + i, units: 'mm' });
        }
        const def = userOpFromStack('u_guard', 'U Guard', [{ type: 'user_root', params: {}, uiChildren: [], children }], bindings);
        const decl = {}; bindings.forEach((b) => { decl[b.param] = { exposed: true }; });
        const g = stackToSlot(def, decl, new Set(), 0);
        const real = fieldVarCollisions(g.fields.map((f) => ({ ...f, _op: 0 })), [{ type: 'universal' }], camBandsOf);
        // SYNTHETIC — a universal field parked on #95 (the saved machine Z a clearance hop overwrites)
        const synth = fieldVarCollisions([{ key: 'z', label: 'Plunge Z', var: '#95', _op: 0 }], [{ type: 'universal' }], camBandsOf);
        // and WITHOUT the resolver the universal arm is invisible — which is what slice C had to close
        const unresolved = fieldVarCollisions([{ key: 'z', label: 'Plunge Z', var: '#95', _op: 0 }], [{ type: 'universal' }]);
        return { real: real.length, synth: synth.length, synthVar: synth[0] && synth[0].varNum, msg: collisionMessage(synth), unresolved: unresolved.length };
    });
    expect(r.real, 'the REAL universal slot gives the guard NOTHING to catch (slice C made it impossible)').toBe(0);
    expect(r.synth, 'a universal field parked in the injected band is still DETECTED').toBe(1);
    expect(r.synthVar, 'and it is the right variable').toBe(95);
    expect(r.msg, 'the refusal names the variable').toMatch(/#95/);
    expect(r.msg, 'and the field').toMatch(/Plunge Z/i);
    expect(r.unresolved, 'without the resolver the universal arm was invisible to the guard — that is the gap slice C closed').toBe(0);
});
