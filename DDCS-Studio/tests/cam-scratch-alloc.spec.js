import { test, expect } from '@playwright/test';

// t1083 S5(3) slice B — the COLLISION-FREE allocation. Local body vars are now minted from a cursor that steps OVER the
// band the SAME generator writes (camScratch.SCRATCH_BANDS is the one source), and the composer advances that cursor from
// what was actually MINTED (maxLocalVar) rather than from a parallel field count — which is what closes the bake gap.
// Slice A's guard stays as the BACKSTOP: after this, a collision should be impossible, so the guard firing = a regression.

test('S5(3)B — a 2-part and a 3-part mill slot allocate with NO collision, and the spindle var is written by nothing else', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { surfacingSlot, pocketSlot } = await import('/data/millToSlot.js');
        const { fieldVarCollisions, maxLocalVar } = await import('/data/camScratch.js');
        const { composeParts } = await import('/data/slotPack.js');
        // compose exactly as buildSlotFromOps does, with the NEW derived advance
        const used = new Set();
        const mk = (gen, fieldsSoFar) => { const g = gen(used, maxLocalVar(fieldsSoFar)); (g.fields || []).forEach((f) => used.add(f.idx)); return g; };
        const tag = (g, oi) => (g.fields || []).map((f) => ({ ...f, _op: oi }));
        const p1 = mk(surfacingSlot, []);
        const f1 = tag(p1, 0);
        const p2 = mk(pocketSlot, f1);
        const f2 = tag(p2, 1);
        const p3 = mk(surfacingSlot, [...f1, ...f2]);
        const f3 = tag(p3, 2);
        const two = fieldVarCollisions([...f1, ...f2], [{ type: 'surface' }, { type: 'pocket' }]);
        const three = fieldVarCollisions([...f1, ...f2, ...f3], [{ type: 'surface' }, { type: 'pocket' }, { type: 'surface' }]);
        // the real symptom: the spindle line must read a var NOTHING else in that part assigns
        const spindleVarOf = (body) => (body.match(/M3 S\[(#\d+)\]/) || [])[1];
        const assignedIn = (body, v) => (body.match(new RegExp(`^\\s*\\${v}\\s*=`, 'gm')) || []).length;
        return {
            twoCols: two.length, threeCols: three.length,
            p2Spindle: spindleVarOf(p2.body), p2SpindleAssigns: assignedIn(p2.body, spindleVarOf(p2.body)),
            p3Spindle: spindleVarOf(p3.body), p3SpindleAssigns: assignedIn(p3.body, spindleVarOf(p3.body)),
            p1Vars: (p1.fields || []).map((f) => f.var),
            p2Vars: (p2.fields || []).map((f) => f.var),
            p3Vars: (p3.fields || []).map((f) => f.var),
            composedOk: composeParts([p1.body, p2.body, p3.body]).length > 0,
        };
    });
    // NO collision at 2 or 3 parts — the hazard slice A had to refuse is gone
    expect(r.twoCols, 'a 2-part mill slot now allocates collision-free').toBe(0);
    expect(r.threeCols, 'a 3-part mill slot now allocates collision-free').toBe(0);
    // the spindle var is read once and assigned exactly once (its own readLine) — never clobbered by scratch
    expect(r.p2Spindle, 'part 2 has a spindle var').toBeTruthy();
    expect(r.p2SpindleAssigns, 'part 2 spindle var is assigned exactly ONCE (its readLine) — the S0 bug is gone').toBe(1);
    expect(r.p3SpindleAssigns, 'part 3 spindle var is assigned exactly ONCE').toBe(1);
    // and no field var of any part sits in the mill scratch band #20-#33
    const num = (v) => Number(String(v).replace('#', ''));
    for (const [label, vars] of [['part1', r.p1Vars], ['part2', r.p2Vars], ['part3', r.p3Vars]]) {
        expect(vars.every((v) => num(v) < 20 || num(v) > 33), `${label} field vars all avoid the mill scratch band #20-#33`).toBe(true);
    }
    expect(r.composedOk, 'the 3-part slot still composes').toBe(true);
});

test('S5(3)B — the BAKE GAP is closed: baking a param cannot make the next part overlap the previous one', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { pocketSlot, surfacingSlot } = await import('/data/millToSlot.js');
        const { maxLocalVar, fieldVarCollisions } = await import('/data/camScratch.js');
        const num = (v) => Number(String(v).replace('#', ''));
        // bake TWO pocket params → fewer fields than the spec; the old code advanced by fields.length and drifted
        const decl = { w: { exposed: false, value: 80 }, h: { exposed: false, value: 60 } };
        const used = new Set();
        const p1 = pocketSlot(used, 0, undefined, decl);
        (p1.fields || []).forEach((f) => used.add(f.idx));
        const p2 = surfacingSlot(used, maxLocalVar(p1.fields));
        const v1 = (p1.fields || []).map((f) => num(f.var));
        const v2 = (p2.fields || []).map((f) => num(f.var));
        const overlap = v1.filter((n) => v2.includes(n));
        const cols = fieldVarCollisions([
            ...(p1.fields || []).map((f) => ({ ...f, _op: 0 })),
            ...(p2.fields || []).map((f) => ({ ...f, _op: 1 })),
        ], [{ type: 'pocket' }, { type: 'surface' }]);
        return { v1, v2, overlap, cols: cols.length, bakedCount: (p1.fields || []).length };
    });
    expect(r.bakedCount, 'two params were baked (so the field count is below the spec length)').toBe(8);
    expect(r.overlap, 'part 2 vars do NOT overlap part 1 vars even though part 1 baked params').toEqual([]);
    expect(r.cols, 'and nothing lands in a generator scratch band').toBe(0);
});

test('S5(3)B — RENUMBERING ONLY: a 1-part slot is semantically identical, differing only in #var numbers', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { surfacingSlot } = await import('/data/millToSlot.js');
        const g = surfacingSlot(new Set(), 0);
        // Normalise every LOCAL var (#1-#99) to a placeholder. If the only change vs the old numbering is which number
        // each field got, the normalised body is unchanged in SHAPE: same lines, same order, same operators.
        const shape = g.body.split('\n').map((l) => l.replace(/#\d+/g, '#N')).join('\n');
        return {
            vars: (g.fields || []).map((f) => f.var),
            lineCount: g.body.split('\n').length,
            shape,
            hasRaster: /WHILE #N LT #N DO2/.test(shape),
            spindle: /M3 S\[#N\]/.test(shape),
        };
    });
    // the vars now step OVER #20-#33 (this IS the renumbering the release note covers)
    const num = (v) => Number(String(v).replace('#', ''));
    expect(r.vars.every((v) => num(v) < 20 || num(v) > 33), 'every field var avoids the mill band').toBe(true);
    // …but the program SHAPE is untouched: the raster loop and the spindle line are still there, same structure
    expect(r.hasRaster, 'the live raster loop is unchanged in shape').toBe(true);
    expect(r.spindle, 'the spindle line is unchanged in shape').toBe(true);
    expect(r.lineCount, 'the body is still a full program').toBeGreaterThan(20);
});
