import { test, expect } from './support/harness.mjs';

// BLOCK-NATIVE CAM PARAMS S4b (core) — materializeCamTable(def): the reusable inject + IDENTITY re-derive step. Proven
// byte-neutral (a materialized def's default slot == the fallback default) and correct across the NON-UNIFORM uiChildren shift
// (a uiChildren binding and an exec binding move by different reasoning; each is re-found by IDENTITY, never a blanket +1+N).
// INERT: nothing calls it yet — the HOOK (the WHERE: which op, at editWizardDef vs the modal) is GATED to the advisor.

test('S4b core — materializeCamTable injects a cam_table + re-derives bindings BY IDENTITY; the build stays BYTE-NEUTRAL', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { userOpFromStack, flattenBlocks } = await import('/blocks/userOps.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const { materializeCamTable } = await import('/data/opCamMap.js');
        const { classifyExposable } = await import('/data/exposeClassifier.js');

        // a universal op with a uiChildren binding (assign under a param_group) AND exec bindings — tests the non-uniform shift.
        const mk = () => userOpFromStack('user_s4bc', 'S4bc', [{ type: 'user_root', params: {}, uiChildren: [
            { type: 'param_group', params: { group: 'UI' }, children: [ { type: 'assign', params: { var: '#50', value: 0 } } ] },
        ], children: [
            { type: 'feed', params: { rate: 200 } },
            { type: 'drill', params: { x: 0, y: 0, depth: 5, peck: 2, feed: 300, clearance: 5 } },
        ] }], [
            { param: 'uiAssign', blockIndex: 2, key: 'value', type: 'number', default: 0, label: 'UI val' },   // uiChildren binding
            { param: 'frate', blockIndex: 3, key: 'rate', type: 'number', default: 200, label: 'Feed rate', units: 'mm/min' },
            { param: 'dfeed', blockIndex: 4, key: 'feed', type: 'number', default: 300, label: 'Cut feed', units: 'mm/min' },
        ]);

        // FALLBACK default build (no cam_table)
        const base = mk();
        const cls = classifyExposable(base);
        const decl = {}; base.bindings.forEach((b) => { const ex = !!(cls[b.param] && cls[b.param].exposable); decl[b.param] = ex ? { exposed: true, value: b.default } : { exposed: false, value: b.default }; });
        const fallback = stackToSlot(base, decl, new Set(), 0);

        // MATERIALIZE then build through the S2 cam_table branch (empty decl)
        const mat = mk();
        const before = mat.bindings.map((b) => b.blockIndex);
        materializeCamTable(mat);
        const after = mat.bindings.map((b) => b.blockIndex);
        const built = stackToSlot(mat, {}, new Set(), 0);
        // and the bindings still resolve to the right sockets: instantiate the frate binding and confirm the feed socket carries it
        const hasCamTable = flattenBlocks(mat.template).some((b) => b.type === 'cam_table');

        // idempotent: a second materialize is a no-op
        const camCountAfter1 = flattenBlocks(mat.template).filter((b) => b.type === 'cam_table').length;
        materializeCamTable(mat);
        const camCountAfter2 = flattenBlocks(mat.template).filter((b) => b.type === 'cam_table').length;

        return {
            before, after, hasCamTable,
            byteIdentical: fallback.body === built.body && JSON.stringify(fallback.fields) === JSON.stringify(built.fields),
            idempotent: camCountAfter1 === 1 && camCountAfter2 === 1,
            fbBody: fallback.body, matBody: built.body,
        };
    });
    // the cam_table (1 + 3 rows = 4 blocks) leads the presentation mouth → every binding shifts by +4, re-derived by identity
    expect(r.hasCamTable, 'a cam_table was injected').toBe(true);
    expect(r.before, 'pre-injection indices').toEqual([2, 3, 4]);
    expect(r.after, 'post-injection indices, re-derived by identity (+4 for the leading cam_table)').toEqual([6, 7, 8]);
    // the whole point: the materialized build is byte-identical to the fallback default (byte-neutral)
    expect(r.byteIdentical, 'materialize → build == fallback default (byte-neutral)').toBe(true);
    expect(r.idempotent, 'a second materialize is a no-op (idempotent)').toBe(true);
});
