import { test, expect } from '@playwright/test';

// BLOCK-NATIVE CAM PARAMS S3 — the LAZY materializer camTableFromBindings(def): a def's value bindings → a cam_table
// (one cam_field per binding, PRE-ORDER, mode = the classifier default, label from the binding). Consuming it via S2's
// cam_table branch reproduces today's DEFAULT field set → BYTE-NEUTRAL. S1-style: the materializer is committed as the
// ready building block; the LAZY HOOK that injects it into a def is GATED to S4 (see the divergence test below) — nothing
// calls camTableFromBindings yet, so this changes no behaviour.

const base = () => ({
    stack: [{ type: 'user_root', params: {}, children: [
        { type: 'feed', params: { rate: 200 } },
        { type: 'drill', params: { x: 0, y: 0, depth: 5, peck: 2, feed: 300, clearance: 5 } },
    ] }],
    bindings: [
        { param: 'frate', blockIndex: 1, key: 'rate', type: 'number', default: 200, label: 'Feed rate', units: 'mm/min' },
        { param: 'ddepth', blockIndex: 2, key: 'depth', type: 'number', default: 5, label: 'Depth', units: 'mm' },   // drill depth → geometry (loop bound) → BAKE
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
    // pre-order, one per binding; exposable (feed) → expose, geometry (drill depth) → bake at the binding default
    expect(r.rows).toEqual([
        { type: 'cam_field', param: 'frate', mode: 'expose', baked: '', label: 'Feed rate' },
        { type: 'cam_field', param: 'ddepth', mode: 'bake', baked: '5', label: 'Depth' },
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

// The KNOWN DIVERGENCE that GATES the lazy hook to S4 — DOCUMENTED here so it is caught the moment S4 fixes it.
// After materializing a cam_table into the built def, S2's branch drives the slot and IGNORES the modal's decl. So a modal
// per-slot expose/bake FLIP is silently ignored by the build. This is why S3 ships ONLY the materializer (inert) and gates
// the hook: wiring materialization into the def the modal builds would make the modal's radios silently no-op until S4
// (modal-as-view) or a Fork-C decl-override lands. When S4 makes the modal write blocks, this test should be revisited.
test('S3 (gated) — a modal FLIP on a materialized def is NOT honored by the build (the S4-inversion divergence)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { userOpFromStack } = await import('/blocks/userOps.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const { camTableFromBindings } = await import('/data/opCamMap.js');
        const b = new Function('return ' + mk)()();
        const def = userOpFromStack('user_s3', 'U S3', b.stack, b.bindings);
        const ct = camTableFromBindings(def); const N = ct.children.length;
        const matTemplate = [{ type: 'user_root', id: 'ur', params: {}, uiChildren: [ct], children: JSON.parse(JSON.stringify(b.stack[0].children)) }];
        const matDef = { opType: 'user_s3', label: 'U S3', template: matTemplate, bindings: b.bindings.map((bd) => ({ ...bd, blockIndex: bd.blockIndex + 1 + N })) };
        // the user bakes the exposed feed to 999 in the modal → decl says bake, but the cam_table says expose
        const flipped = stackToSlot(matDef, { frate: { exposed: false, value: 999 } }, new Set(), 0);
        return { honored: /F999\b/.test(flipped.body) && !/;Feed rate/.test(flipped.body), body: flipped.body };
    }, base.toString());
    // DOCUMENTED current behaviour: the flip is IGNORED (feed stays exposed via #2600, not baked to 999). This is the gate.
    expect(r.honored, 'the modal flip is NOT honored while a cam_table is present — the S4 inversion; the hook is gated until then').toBe(false);
    expect(r.body, 'feed remains exposed from its #2600 mirror (the cam_table default won, not the modal bake)').toMatch(/F#\d/);
});
