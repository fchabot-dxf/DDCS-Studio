import { test, expect } from '@playwright/test';

// BLOCK-NATIVE CAM PARAMS S2 — stackToSlot/seedUniversal CONSUME camFieldsFromStack, ADDITIVE-BY-FALLBACK. When a def's
// template carries a cam_table, its cam_field ROWS drive the slot: field ORDER = block order (→ #11xx/#2600 order), row.mode
// = expose/bake, row.label = pendant label, a baked row inlines its literal with NO #2600 row. When there is NO cam_table
// (every op today) the UNCHANGED bindings/decl path runs → byte-identical (the goldens + the existing universal specs prove it).

// A def whose template puts a cam_table (N rows) in the user_root PRESENTATION mouth. NB flattenBlocks visits uiChildren
// BEFORE children, so the cam_table + its rows SHIFT the execution atoms' flat indices — the bindings account for that:
//   0 user_root · 1 cam_table · 2..(1+N) cam_field rows · then the execution atoms.
const defWith = (rows) => {
    const N = rows.length;
    const feedIdx = 2 + N, moveIdx = 3 + N;   // feed atom, move atom (after the N cam_field rows)
    return {
        opType: 'user_s2', label: 'U S2',
        template: [{
            type: 'user_root', id: 'ur', params: {},
            uiChildren: [{ type: 'cam_table', id: 'ct', params: {}, children: rows.map((r, i) => ({ type: 'cam_field', id: 'cf' + i, params: { param: r.param, label: r.label || '', mode: r.mode || 'expose', baked: r.baked || '', units: r.units || '', dflt: r.dflt != null ? String(r.dflt) : '', nmin: '', nmax: '' } })) }],
            children: [
                { type: 'feed', id: 'f', params: { rate: 200 } },
                { type: 'move', id: 'm', params: { mode: 'cut', x: 10, y: 20, z: -3, feed: 500 } },
            ],
        }],
        bindings: [
            { param: 'feed', blockIndex: feedIdx, key: 'rate', type: 'number', default: 200, label: 'Feed', units: 'mm/min' },
            { param: 'movefeed', blockIndex: moveIdx, key: 'feed', type: 'number', default: 500, label: 'Cut feed', units: 'mm/min' },
            { param: 'depth', blockIndex: moveIdx, key: 'z', type: 'number', default: -3, label: 'Plunge Z', units: 'mm' },
        ],
    };
};

test('S2 — a cam_table drives the slot: fields in BLOCK ORDER, row mode/label, baked inlines with no #2600 row', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const build = new Function('return ' + mk)();
        // rows: feed EXPOSE (labelled), movefeed EXPOSE, depth BAKE to -2
        const def = build([
            { param: 'feed', mode: 'expose', label: 'Feed rate' },
            { param: 'movefeed', mode: 'expose', label: 'Cut feed' },
            { param: 'depth', mode: 'bake', baked: '-2' },
        ]);
        const slot = stackToSlot(def, {}, new Set(), 0);
        return { fields: slot.fields.map((f) => ({ key: f.key, var: f.var, idx: f.idx, label: f.label })), body: slot.body };
    }, defWith.toString());
    // exactly the two EXPOSED rows became fields, IN BLOCK ORDER (feed then movefeed); the baked depth is NOT a field
    expect(r.fields.map((f) => f.key), 'fields in block order, baked row excluded').toEqual(['feed', 'movefeed']);
    expect(r.fields[0], 'row 1 = feed, the block label, first #var + #11xx').toMatchObject({ key: 'feed', var: '#1', idx: 1100, label: 'Feed rate' });
    expect(r.fields[1], 'row 2 = movefeed, second').toMatchObject({ key: 'movefeed', var: '#2', idx: 1101, label: 'Cut feed' });
    // the exposed rows read their #2600 mirror IN ORDER; the baked depth has NO #2600 row and inlines Z-2
    expect(r.body, 'feed reads #2600').toMatch(/#1=#2600\s+;Feed rate/);
    expect(r.body, 'movefeed reads #2601').toMatch(/#2=#2601\s+;Cut feed/);
    expect(r.body, 'no third mirror read (depth is baked)').not.toMatch(/#3=#2602/);
    expect(r.body, 'the exposed feed rides its #var').toMatch(/F#1\b/);
    expect(r.body, 'the baked depth inlines its literal Z-2 (no #var)').toContain('Z-2');
    expect(r.body, 'and depth never became a #2600 mirror').not.toMatch(/;Plunge Z/);
});

test('S2 — reordering the cam_field blocks reorders the #2600 mirror rows (block order = pendant order)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const build = new Function('return ' + mk)();
        const A = stackToSlot(build([{ param: 'feed', mode: 'expose' }, { param: 'movefeed', mode: 'expose' }]), {}, new Set(), 0);
        const B = stackToSlot(build([{ param: 'movefeed', mode: 'expose' }, { param: 'feed', mode: 'expose' }]), {}, new Set(), 0);
        return { aKeys: A.fields.map((f) => f.key), aVars: A.fields.map((f) => f.var), bKeys: B.fields.map((f) => f.key), bVars: B.fields.map((f) => f.var),
            aFeedMirror: /#(\d)=#2600[^\n]*Feed/.test(A.body), bMoveFirst: /#1=#2600/.test(B.body) };
    }, defWith.toString());
    // order A: feed=#1 (→#2600), movefeed=#2 (→#2601)
    expect(r.aKeys).toEqual(['feed', 'movefeed']);
    expect(r.aVars).toEqual(['#1', '#2']);
    // order B (swapped): movefeed=#1 (→#2600), feed=#2 (→#2601) — the mirror rows swapped with the blocks
    expect(r.bKeys, 'swapping the cam_field blocks swaps the field order').toEqual(['movefeed', 'feed']);
    expect(r.bVars).toEqual(['#1', '#2']);
});

test('S2 — a def with NO cam_table falls back to the UNCHANGED decl path (byte-identical)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { userOpFromStack } = await import('/blocks/userOps.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');
        // the classic U0 shape (no cam_table) — the decl drives expose/bake exactly as before S2
        const stack = [{ type: 'user_root', params: {}, children: [
            { type: 'feed', params: { rate: 200 } },
            { type: 'move', params: { mode: 'cut', x: 10, y: 20, z: -3, feed: 500 } },
        ] }];
        const def = userOpFromStack('u_nofb', 'U NoFb', stack, [
            { param: 'feed', blockIndex: 1, key: 'rate', type: 'number', default: 200, label: 'Feed', units: 'mm/min' },
            { param: 'z', blockIndex: 2, key: 'z', type: 'number', default: -3, label: 'Plunge Z' },
        ]);
        const slot = stackToSlot(def, { feed: { exposed: true }, z: { exposed: false, value: -3 } }, new Set(), 0);
        return { fields: slot.fields.map((f) => ({ key: f.key, var: f.var, label: f.label })), body: slot.body };
    });
    // the decl path: feed exposed (#1, the BINDING label), z baked — exactly the pre-S2 behaviour
    expect(r.fields, 'fallback = decl-driven, binding label').toEqual([{ key: 'feed', var: '#1', label: 'Feed' }]);
    expect(r.body, 'feed exposed via decl').toMatch(/#1=#2600\s+;Feed/);
    expect(r.body).toMatch(/F#1\b/);
    expect(r.body, 'z baked to the literal').toContain('Z-3');
});

test('S2 — seedUniversal ALSO orders by the cam_field rows (mode + label), and falls back byte-identically', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { seedFromOp } = await import('/data/opCamMap.js');
        const { getUserDef, registerUserOp } = await import('/blocks/userOps.js');
        const build = new Function('return ' + mk)();
        // register a def WITH a cam_table so camTypeOf('u_s2') resolves it as universal and seedUniversal reads its rows
        const def = build([
            { param: 'depth', mode: 'bake', baked: '-4' },
            { param: 'feed', mode: 'expose', label: 'Feed rate' },
        ]);
        registerUserOp(def);
        const seeded = seedFromOp({ opType: 'user_s2', params: {} });
        return { fields: (seeded.fields || []).map((f) => ({ key: f.key, exposed: f.exposed, label: f.label })) };
    }, defWith.toString());
    // seed order = block order: depth(bake) first, feed(expose) second; mode + label come from the rows
    expect(r.fields.map((f) => f.key), 'seed fields in block order').toEqual(['depth', 'feed']);
    expect(r.fields[0], 'the bake row seeds exposed:false').toMatchObject({ key: 'depth', exposed: false });
    expect(r.fields[1], 'the expose row seeds exposed:true with the block label').toMatchObject({ key: 'feed', exposed: true, label: 'Feed rate' });
});
