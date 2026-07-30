import { test, expect } from '@playwright/test';

// BLOCK-NATIVE CAM PARAMS S3 — the LAZY materializer camTableFromBindings(def): a def's value bindings → a cam_table
// (one cam_field per binding, PRE-ORDER, mode = the classifier default, label from the binding). Consuming it via S2's
// cam_table branch reproduces today's DEFAULT field set → BYTE-NEUTRAL. S1-style: the materializer is committed as the
// ready building block; the LAZY HOOK that injects it into a def is GATED to S4 (see the divergence test below) — nothing
// calls camTableFromBindings yet, so this changes no behaviour.

const base = () => ({
    stack: [{ type: 'user_root', params: {}, children: [
        { type: 'feed', params: { rate: 200 } },
        { type: 'holecycle', params: { pattern: 'single', cycle: 'peck', x0: 0, y0: 0, depth: 5, peck: 2, feed: 300, clearance: 5 } },
    ] }],
    bindings: [
        { param: 'frate', blockIndex: 1, key: 'rate', type: 'number', default: 200, label: 'Feed rate', units: 'mm/min' },
        { param: 'ddepth', blockIndex: 2, key: 'depth', type: 'number', default: 5, label: 'Depth', units: 'mm' },   // t1391 — the hole depth: was a literal-kernel LOOP BOUND (bake), is now a live register seed (EXPOSE)
        { param: 'dfeed', blockIndex: 2, key: 'feed', type: 'number', default: 300, label: 'Cut feed', units: 'mm/min' },   // drill feed → value (t1091) → EXPOSE
    ],
});

test('S3 — camTableFromBindings: one row per binding in PRE-ORDER, mode = classifier default, label from the binding', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { userOpFromStack } = await import('/blocks/userOps.js');
        const { camTableFromBindings } = await import('/data/opCamMap.js');
        const b = new Function('return ' + mk)()();
        const def = userOpFromStack('user_s3', 'U S3', b.stack, b.bindings);
        const ct = camTableFromBindings(def);
        return { type: ct.type, rows: ct.children.map((c) => ({ type: c.type, param: c.params.param, mode: c.params.mode, baked: c.params.baked, label: c.params.label })) };
    }, base.toString());
    expect(r.type).toBe('cam_table');
    // Pre-order, one per binding; mode = the classifier's default for that param.
    //
    // t1391 — THE DEPTH ROW FLIPPED, and the flip is the point rather than a repair. The fixture used the retired literal
    // `drill`, whose depth drove a JS loop and therefore BAKED. It is `holecycle` now, whose depth is the #81 register seed
    // t1389 put val() on — so the classifier's default for it is EXPOSE, with an empty `baked`. The row order, the labels
    // and the feed rows are untouched, which is what says only the depth SEMANTICS moved.
    expect(r.rows).toEqual([
        { type: 'cam_field', param: 'frate', mode: 'expose', baked: '', label: 'Feed rate' },
        { type: 'cam_field', param: 'ddepth', mode: 'expose', baked: '', label: 'Depth' },
        { type: 'cam_field', param: 'dfeed', mode: 'expose', baked: '', label: 'Cut feed' },
    ]);
});

test('S3 — BYTE-NEUTRAL: a materialized cam_table builds the DEFAULT slot byte-identically to the fallback', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { userOpFromStack } = await import('/blocks/userOps.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const { camTableFromBindings } = await import('/data/opCamMap.js');
        const { classifyExposable } = await import('/data/exposeClassifier.js');
        const b = new Function('return ' + mk)()();
        const def = userOpFromStack('user_s3', 'U S3', b.stack, b.bindings);
        const cls = classifyExposable(def);

        // FALLBACK: the decl makeAuthOp seeds by default — exposable→exposed:true, geometry→exposed:false + the op value
        const decl = {};
        b.bindings.forEach((bd) => { const ex = !!(cls[bd.param] && cls[bd.param].exposable); decl[bd.param] = ex ? { exposed: true, value: bd.default } : { exposed: false, value: bd.default }; });
        const fallback = stackToSlot(def, decl, new Set(), 0);

        // MATERIALIZED: inject the cam_table into the presentation mouth. NB flattenBlocks visits uiChildren BEFORE children,
        // so the cam_table + its N rows shift the execution atoms up by 1+N — the bindings must be re-indexed (as an in-place
        // by-identity re-derive would do at a real hook; here the shift is uniform because all bindings are execution atoms).
        const ct = camTableFromBindings(def);
        const N = ct.children.length;
        const matTemplate = [{ type: 'user_root', id: 'ur', params: {}, uiChildren: [ct], children: JSON.parse(JSON.stringify(b.stack[0].children)) }];
        const matDef = { opType: 'user_s3', label: 'U S3', template: matTemplate, bindings: b.bindings.map((bd) => ({ ...bd, blockIndex: bd.blockIndex + 1 + N })) };
        const materialized = stackToSlot(matDef, {}, new Set(), 0);

        return { fbBody: fallback.body, matBody: materialized.body,
            fbFields: JSON.stringify(fallback.fields), matFields: JSON.stringify(materialized.fields) };
    }, base.toString());
    expect(r.matBody, 'the materialized default body is byte-identical to the fallback default').toBe(r.fbBody);
    expect(r.matFields, 'and the fields are identical (same keys, vars, labels, defaults, order)').toBe(r.fbFields);
});

// The divergence this once GATED is now CLOSED by S4a (the modal writes the cam_field BLOCK, not a dead decl) + S4b (the hook
// materializes a cam_table for a real op). A modal FLIP now goes through the block, and the build reflects it. MIGRATED from
// "the flip is ignored (honored=false)" to "the flip STICKS (honored=true)". NB a RAW decl bypassing the modal is still
// ignored while a cam_table is present — that is the correct "block is the source" invariant, not a divergence: the modal no
// longer writes decl, so the raw-decl proxy is obsolete; the flip goes through the block (row.mode), which is what sticks.
test('S3→S4 (closed) — a MODAL flip (block write) on a materialized def now STICKS through the build (divergence closed)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { userOpFromStack, flattenBlocks } = await import('/blocks/userOps.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const { camTableFromBindings } = await import('/data/opCamMap.js');
        const b = new Function('return ' + mk)()();
        const def = userOpFromStack('user_s3', 'U S3', b.stack, b.bindings);
        const ct = camTableFromBindings(def); const N = ct.children.length;
        const matTemplate = [{ type: 'user_root', id: 'ur', params: {}, uiChildren: [ct], children: JSON.parse(JSON.stringify(b.stack[0].children)) }];
        const matDef = { opType: 'user_s3', label: 'U S3', template: matTemplate, bindings: b.bindings.map((bd) => ({ ...bd, blockIndex: bd.blockIndex + 1 + N })) };
        // the S4a modal write: flipping the frate radio to Bake mutates the cam_field BLOCK (not a decl)
        const row = flattenBlocks(matDef.template).find((x) => x.type === 'cam_field' && x.params.param === 'frate');
        row.params.mode = 'bake'; row.params.baked = '200';
        const built = stackToSlot(matDef, {}, new Set(), 0);
        return { honored: /F200\b/.test(built.body) && !/;Feed rate/.test(built.body), keys: built.fields.map((f) => f.key), body: built.body };
    }, base.toString());
    // the flip STICKS: frate is now baked (inlined F200, no #2600 mirror), because the modal writes the block and the build reads it
    expect(r.honored, 'the modal flip (block write) is now HONORED by the build — the S3 divergence is closed').toBe(true);
    expect(r.keys, 'frate dropped from the exposed fields (baked)').not.toContain('frate');
});
