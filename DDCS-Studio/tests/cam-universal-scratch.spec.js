import { test, expect } from '@playwright/test';

// t1085 S5(3) SLICE C — the UNIVERSAL arm. The generator arms emit hand-written macro text, so camScratch declares their
// scratch and slice B mints around it. The universal arm emits through emitMapped — the REAL atoms and the REAL active post
// — and both inject low macro vars of their own, so a universal slot's field vars (which start at #1) were landing on top
// of them at ONE part, before any composition. Slice C declares that scratch WHERE IT IS INJECTED (def.scratch on a palette
// atom, dialect.scratch on a post, PROBE_SURFACE_SCRATCH on the composer that has no def) and aggregates it in
// data/universalScratch.js, which stackToSlot passes as the avoid set.

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
    expect(r.bigVars, 'and it skips exactly the declared numbers (#5/#6 probe port + tool radius, #9/#10 last retract)')
        .toEqual(['#1', '#2', '#3', '#4', '#7', '#8', '#11', '#12', '#13', '#14', '#15', '#16']);
    expect(r.bigIdx[0], 'the #11xx pool allocation is untouched by the renumbering').toBe(1100);
    expect(r.allRead, 'every renumbered var is read from its own #2600 mirror').toBe(true);
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
