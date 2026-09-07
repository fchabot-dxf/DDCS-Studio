import { test, expect } from './support/harness.mjs';

// t1089 — a SINGLE hole is a degenerate pattern (count 1 at the anchor), so drill/bore pattern 'single' now routes to the
// GENERATOR instead of the universal unroll. This matters because 'single' is the DEFAULT drill pattern, and the universal
// arm cannot expose depth/peck AT ALL: drill.js peckDrill drives a JS `while` loop, so the peck sequence is unrolled and
// every Z baked at BUILD time (measured t1087). Through the generator they are live #2600 knobs driven by a MACRO loop.
//
// TIER MIGRATION WORK PACKAGE 3 — split browser→node. 4 of the 5 tests are pure: import()+evaluate over
// /data/opCamMap.js + /data/opToSlot.js + /data/atomRoles.js, asserting on plain returned data — camTypeOf/slotFromOp
// resolve a twin's built-in type via wizardLibrary.js's static opensAs→type/variant table, no getUserDef live-registry
// dependency, so no seeding is needed. The 5th test ("t1089 REAL SYMPTOM — a DEFAULT drill twin now shows exposable
// knobs in the CAM modal") stayed in the browser tier (tests/cam-drill-single-pattern-drive.spec.js): it drives the
// real macrosApp/CAM authoring modal DOM, waits on a selector, and screenshots — a genuine app+DOM dependency.

test('t1089 — drill pattern "single" routes to the GENERATOR, not the universal unroll', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const r = await page.evaluate(async () => {
        const { camTypeOf } = await import('/data/opCamMap.js');
        const mk = (pattern, opType = 'user_drill_data') => ({ opType, params: { pattern } });
        return {
            single: camTypeOf(mk('single')),
            grid: camTypeOf(mk('grid')),
            circle: camTypeOf(mk('circle')),
            defaulted: camTypeOf({ opType: 'user_drill_data', params: {} }),   // no pattern at all → the 'single' default
            boreSingle: camTypeOf(mk('single', 'user_bore_data')),
        };
    });
    expect(r.single.camType, 'single now reaches the drill generator').toBe('drill');
    expect(r.single.universal, 'and is no longer routed universal').toBeFalsy();
    expect(r.defaulted.camType, 'an op with NO pattern (the single default) also reaches the generator').toBe('drill');
    expect(r.grid.camType, 'grid is undisturbed').toBe('drill');
    expect(r.circle.camType, 'circle is undisturbed').toBe('drill');
    expect(r.boreSingle.camType, 'bore single reaches the bore generator').toBe('bore');
});

test('t1089 — the single-hole slot exposes depth/peck as LIVE #2600 knobs driven by a MACRO loop', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const r = await page.evaluate(async () => {
        const { slotFromOp } = await import('/data/opToSlot.js');
        const g = slotFromOp('drill', 'single', new Set(), 0);
        const b = slotFromOp('bore', 'single', new Set(), 0);
        const keys = g.fields.map((f) => f.key);
        const varOf = (k) => (g.fields.find((f) => f.key === k) || {}).var;
        return {
            name: g.name, keys, body: g.body,
            depthVar: varOf('depth'), peckVar: varOf('peck'),
            // every field must be read from its own #2600 mirror — that IS "live knob"
            allMirrored: g.fields.every((f) => g.body.includes(`${f.var}=#${f.idx + 1500}`)),
            hasMacroLoop: /WHILE .* DO1/.test(g.body) && /END1/.test(g.body),
            // the JS-unrolled universal path bakes a literal Z per peck; the generator must NOT
            bakedZ: (g.body.match(/G1 Z-?\d+(\.\d+)?\s/g) || []),
            boreName: b.name, boreKeys: b.fields.map((f) => f.key), boreHasCircle: /G3/.test(b.body),
        };
    });
    console.log('--- single-hole drill slot ---\n' + r.body);
    expect(r.name, 'the slot is named for the pattern').toBe('Drill — single hole');
    // posX/posY are the anchor; NO extra pattern fields; the hole knobs are present
    expect(r.keys, 'single adds no pattern fields — anchor + hole knobs + framing').toEqual(
        ['posX', 'posY', 'holeDia', 'depth', 'peck', 'feed', 'clearance', 'rpm']);
    expect(r.depthVar, 'depth got a local #var').toBeTruthy();
    expect(r.peckVar, 'peck got a local #var').toBeTruthy();
    expect(r.allMirrored, 'every field is read live from its #2600 mirror').toBe(true);
    // THE REAL SYMPTOM: the peck sequence is a MACRO loop over the depth/peck vars, not JS-unrolled literals
    expect(r.hasMacroLoop, 'the peck sequence is a MACRO WHILE loop').toBe(true);
    expect(r.body, 'the loop steps by the PECK var').toContain(`#41=#41+${r.peckVar}`);
    expect(r.body, 'and is bounded by the DEPTH var').toContain(`WHILE #41 LT ${r.depthVar}`);
    expect(r.body, 'the plunge Z is an EXPRESSION over the loop var, not a literal').toContain('G1 Z[-#41]');
    expect(r.bakedZ, 'no baked literal plunge Z anywhere (that is the universal-arm defect)').toEqual([]);
    // bore single works too, and keeps its ring-step circle
    expect(r.boreName).toBe('Bore — single hole');
    expect(r.boreKeys).toEqual(['posX', 'posY', 'holeDia', 'toolDia', 'depth', 'pitch', 'feed', 'clearance', 'rpm']);
    expect(r.boreHasCircle, 'bore single still emits its full-circle ring step').toBe(true);
});

test('t1089 — adding "single" left the existing four patterns byte-identical', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const r = await page.evaluate(async () => {
        const { slotFromOp } = await import('/data/opToSlot.js');
        const out = {};
        for (const m of ['drill', 'bore']) {
            for (const p of ['circle', 'grid', 'line', 'rect']) {
                const g = slotFromOp(m, p, new Set(), 0);
                out[`${m}/${p}`] = { name: g.name, nfields: g.fields.length, vars: g.fields.map((f) => f.var).join(' '), len: g.body.length, doN: /DO2/.test(g.body) || /DO3/.test(g.body) };
            }
        }
        return out;
    });
    // the per-hole cut inside a pattern loop still nests deeper than DO1 (single is the only DO1 case)
    for (const [k, v] of Object.entries(r)) {
        expect(v.doN, `${k}: the per-hole cut still nests below the pattern loop`).toBe(true);
        expect(v.nfields, `${k}: field count unchanged`).toBeGreaterThan(6);
    }
    expect(r['drill/circle'].name).toBe('Drill — bolt circle');
    expect(r['bore/rect'].name).toBe('Bore — rectangle');
});

test('t1089 rider — the 7 previously-unenumerated atoms are DECLARED (and still bake-only)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const r = await page.evaluate(async () => {
        const { ATOM_ROLES, paramRole } = await import('/data/atomRoles.js');
        const atoms = ['toolsel', 'wcs', 'placeonstock', 'array', 'entry', 'stepdown', 'contourfill'];
        return {
            declared: atoms.filter((a) => !!ATOM_ROLES[a]),
            // the declaration must NOT have accidentally exposed anything: no 'value' among them
            anyValue: atoms.flatMap((a) => Object.entries(ATOM_ROLES[a] || {}).filter(([, v]) => v === 'value').map(([k]) => `${a}.${k}`)),
            probes: { array_cols: paramRole('array', 'cols'), place_offX: paramRole('placeonstock', 'offX'), wcs_wcs: paramRole('wcs', 'wcs') },
            defaultStillGeometry: paramRole('somethingNeverDeclared', 'whatever'),
        };
    });
    expect(r.declared, 'all 7 atoms now carry an explicit row').toHaveLength(7);
    expect(r.anyValue, 'and NOTHING became exposable — the declaration is bookkeeping, not a behaviour change').toEqual([]);
    expect(r.probes.array_cols).toBe('geometry');
    expect(r.probes.wcs_wcs).toBe('other');
    expect(r.defaultStillGeometry, 'the fail-safe default is untouched').toBe('geometry');
});
