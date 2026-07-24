import { test, expect } from '@playwright/test';

const SCRATCH = 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad';

// BLOCK-NATIVE CAM PARAMS S4b — the materialize HOOK at editWizardDef. maybeMaterializeCamTable(def) gains a cam_table for a
// PILL-BASED UNIVERSAL op (opt-in: when the user opens it to customize in Blocks), and SKIPS a generator twin (its cam_table
// would be inert) and a LITERAL-binding universal twin (no pills → a pre-existing no-pill save limit, gated to S6). This
// activates S2 (the build reads the cam_table) + S4a (the modal writes it) together, byte-neutrally.

// a PILL-BASED universal op: execution atoms with `{type:'param'}` socket pills + matching value bindings; opType routes universal.
const pillDef = () => ({
    opType: 'user_pillfork_data', label: 'Pill Fork',
    template: [{ type: 'user_root', params: {}, children: [
        { type: 'feed', params: { rate: { type: 'param', params: { name: 'frate', value: 200 } } } },
        { type: 'move', params: { mode: 'cut', x: 10, y: 20, z: { type: 'param', params: { name: 'mz', value: -3 } }, feed: 500 } },
    ] }],
    bindings: [
        { param: 'frate', blockIndex: 1, key: 'rate', type: 'number', default: 200, label: 'Feed rate', units: 'mm/min' },
        { param: 'mz', blockIndex: 2, key: 'z', type: 'number', default: -3, label: 'Plunge Z', units: 'mm' },
    ],
});
// a LITERAL-binding universal op: same shape but socket values are LITERALS (no pills)
const literalDef = () => ({
    opType: 'user_litfork_data', label: 'Lit Fork',
    template: [{ type: 'user_root', params: {}, children: [
        { type: 'feed', params: { rate: 200 } },
        { type: 'move', params: { mode: 'cut', x: 10, y: 20, z: -3, feed: 500 } },
    ] }],
    bindings: [
        { param: 'frate', blockIndex: 1, key: 'rate', type: 'number', default: 200, label: 'Feed rate' },
        { param: 'mz', blockIndex: 2, key: 'z', type: 'number', default: -3, label: 'Plunge Z' },
    ],
});

test('S4b — maybeMaterializeCamTable materializes a PILL-based universal op, SKIPS a twin and a LITERAL op', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mks) => {
        const { maybeMaterializeCamTable } = await import('/blocks/devMode.js');
        const { flattenBlocks, getUserDef } = await import('/blocks/userOps.js');
        const pill = new Function('return ' + mks.pill)()();
        const lit = new Function('return ' + mks.literal)()();
        const has = (def) => flattenBlocks(def.template).some((b) => b.type === 'cam_table');

        maybeMaterializeCamTable(pill);
        maybeMaterializeCamTable(lit);
        // a real generator twin (surfacing routes to its generator, not universal) — pass a CLONE so the live registry is untouched
        const twin = JSON.parse(JSON.stringify(getUserDef('user_surfacing_data') || {}));
        const twinHadBindings = !!(twin.bindings || []).length;
        maybeMaterializeCamTable(twin);

        return {
            pillMaterialized: has(pill),
            pillBindings: pill.bindings.map((b) => b.blockIndex),
            litMaterialized: lit.template ? has(lit) : false,
            twinHadBindings, twinMaterialized: twin.template ? has(twin) : false,
        };
    }, { pill: pillDef.toString(), literal: literalDef.toString() });
    expect(r.pillMaterialized, 'a pill-based universal op gets a cam_table').toBe(true);
    // cam_table (1 + 2 rows = 3 blocks) leads the presentation mouth → bindings 1/2 re-derived to 4/5 by identity
    expect(r.pillBindings, 'bindings re-derived by identity across the injection').toEqual([4, 5]);
    expect(r.litMaterialized, 'a LITERAL-binding universal op is SKIPPED (no pills → gated to S6)').toBe(false);
    expect(r.twinHadBindings, 'the surfacing twin is registered with bindings').toBe(true);
    expect(r.twinMaterialized, 'a generator twin gets NO cam_table (its build never reads one)').toBe(false);
});

test('S4b — the materialized pill op is BYTE-NEUTRAL (default slot == the fallback) and idempotent', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { maybeMaterializeCamTable } = await import('/blocks/devMode.js');
        const { flattenBlocks } = await import('/blocks/userOps.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const { classifyExposable } = await import('/data/exposeClassifier.js');
        const base = new Function('return ' + mk)()();
        // fallback default build (no cam_table)
        const cls = classifyExposable(base);
        const decl = {}; base.bindings.forEach((b) => { const ex = !!(cls[b.param] && cls[b.param].exposable); decl[b.param] = ex ? { exposed: true, value: b.default } : { exposed: false, value: b.default }; });
        const fallback = stackToSlot(base, decl, new Set(), 0);
        // materialize a fresh copy and build via S2
        const mat = new Function('return ' + mk)()();
        maybeMaterializeCamTable(mat);
        const built = stackToSlot(mat, {}, new Set(), 0);
        const count1 = flattenBlocks(mat.template).filter((b) => b.type === 'cam_table').length;
        maybeMaterializeCamTable(mat);   // idempotent
        const count2 = flattenBlocks(mat.template).filter((b) => b.type === 'cam_table').length;
        return { byteIdentical: fallback.body === built.body && JSON.stringify(fallback.fields) === JSON.stringify(built.fields), idempotent: count1 === 1 && count2 === 1 };
    }, pillDef.toString());
    expect(r.byteIdentical, 'materialize → build == fallback default (byte-neutral)').toBe(true);
    expect(r.idempotent, 'a second materialize is a no-op').toBe(true);
});

test('S4b — the S3 divergence is CLOSED: on a materialized op, a MODAL flip (block write) STICKS through the build', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { maybeMaterializeCamTable } = await import('/blocks/devMode.js');
        const { flattenBlocks } = await import('/blocks/userOps.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const mat = new Function('return ' + mk)()();
        maybeMaterializeCamTable(mat);
        // the S4a modal write: flip the frate cam_field block to bake (as cbmToggle does)
        const row = flattenBlocks(mat.template).find((b) => b.type === 'cam_field' && b.params.param === 'frate');
        row.params.mode = 'bake'; row.params.baked = '200';
        const built = stackToSlot(mat, {}, new Set(), 0);
        return { keys: built.fields.map((f) => f.key), body: built.body };
    }, pillDef.toString());
    // the flip STICKS: frate is now baked (dropped from the fields, inlines F200), mz stays exposed — the S3-gated divergence is closed
    expect(r.keys, 'frate baked (flip honored), mz still exposed').toEqual(['mz']);
    expect(r.body, 'the flip stuck: frate inlines F200, no #2600 mirror for it').toMatch(/F200\b/);
    expect(r.body, 'and no ;Feed rate mirror row').not.toMatch(/;Feed rate/);
});

test.describe(() => {
    test.use({ viewport: { width: 1400, height: 1000 } });
    test('S4b integration — opening a pill-based universal op in editWizardDef materializes the cam_table in the workspace', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsEditWizardDef && window.showApp);
        await page.evaluate(async (mk) => {
            const { registerUserOp } = await import('/blocks/userOps.js');
            const def = new Function('return ' + mk)()();
            registerUserOp(def);   // the LIVE registry (getUserDef)
            localStorage.setItem('ddcs_user_ops', JSON.stringify([def]));   // the STORE (listUserOps, which editWizardDef reads)
        }, pillDef.toString());
        await page.evaluate(() => window.ddcsEditWizardDef('user_pillfork_data'));
        // the workspace loads the op with the materialized cam_table (round-trips through Blockly)
        await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).some((b) => b.type === 'cam_table'), { timeout: 8000 });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SCRATCH}/s4b-editwizard-materialized.png` });   // VIEWED — the cam_table appears on customize-open
        const r = await page.evaluate(() => {
            const camTable = window.__blkws.getAllBlocks(false).filter((b) => b.type === 'cam_table').length;
            const camFields = window.__blkws.getAllBlocks(false).filter((b) => b.type === 'cam_field').length;
            return { camTable, camFields };
        });
        expect(r.camTable, 'a cam_table materialized in the workspace on customize-open').toBe(1);
        expect(r.camFields, 'with a cam_field per value binding (frate + mz)').toBe(2);
    });
});
