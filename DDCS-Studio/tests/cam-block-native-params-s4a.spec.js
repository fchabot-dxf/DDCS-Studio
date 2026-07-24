import { test, expect } from '@playwright/test';

const SCRATCH = 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad';

// BLOCK-NATIVE CAM PARAMS S4a — the MODAL becomes a VIEW of the cam_field blocks, ADDITIVE-BY-FALLBACK. When the op's def
// carries a cam_table, renderCbmTable READS the expose/bake/value from the cam_field block records and cbmToggle / the value
// inputs WRITE to them (the block IS the state, one source; the S2 build reads the same cam_table). When there is NO cam_table
// (every op until the S4b hook) it falls back to the _authoring.ops/decl path UNCHANGED, so S4a is inert today. Read + write
// are ONE unit behind the cam_table-present check — a read-from-blocks / write-to-decl split would re-create the S3 divergence.

// Register a universal op WHOSE def carries a cam_table (hand-added, as the S4b hook will do). NB the cam_table in the
// presentation mouth shifts the execution atoms' flat indices, so the bindings are re-indexed by +1+N (as a real hook would).
async function registerWithCamTable(page) {
    await page.evaluate(async () => {
        const { userOpFromStack, registerUserOp } = await import('/blocks/userOps.js');
        const { camTableFromBindings } = await import('/data/opCamMap.js');
        const baseStack = [{ type: 'user_root', params: {}, children: [
            { type: 'feed', params: { rate: 200 } },
            { type: 'drill', params: { x: 0, y: 0, depth: 5, peck: 2, feed: 300, clearance: 5 } },
        ] }];
        const baseBindings = [
            { param: 'frate', blockIndex: 1, key: 'rate', type: 'number', default: 200, label: 'Feed rate', units: 'mm/min' },
            { param: 'ddepth', blockIndex: 2, key: 'depth', type: 'number', default: 5, label: 'Depth', units: 'mm' },      // drill depth → geometry → BAKE row
            { param: 'dfeed', blockIndex: 2, key: 'feed', type: 'number', default: 300, label: 'Cut feed', units: 'mm/min' },  // drill feed → value → EXPOSE row
        ];
        const baseDef = userOpFromStack('s4a_data', 'S4a', baseStack, baseBindings);
        const ct = camTableFromBindings(baseDef);
        const N = ct.children.length;
        const finalStack = [{ type: 'user_root', params: {}, uiChildren: [ct], children: JSON.parse(JSON.stringify(baseStack[0].children)) }];
        const finalBindings = baseBindings.map((b) => ({ ...b, blockIndex: b.blockIndex + 1 + N }));
        registerUserOp(userOpFromStack('s4a_data', 'S4a', finalStack, finalBindings));
        window.__op = { id: 'o', type: 'op', opType: 'user_s4a_data', label: 'S4a', params: {} };
        window.ddcsGetBlockProgram = () => [window.__op];
    });
    await page.evaluate(async () => { (await import('/ui/macrosApp.js')).initMacrosApp(); window.ddcsOpenCamAuthoring(window.__op); });
    await page.waitForSelector('.cam-auth-overlay .cbm-eb');
}

const rowState = () => {
    const out = {};
    document.querySelectorAll('.cam-auth-overlay .cbm-eb[data-mode="expose"]').forEach((e) => {
        out[e.dataset.fkey] = { expose: e.checked, exposeDisabled: e.disabled };
    });
    document.querySelectorAll('.cam-auth-overlay .cbm-eb[data-mode="bake"]').forEach((e) => { (out[e.dataset.fkey] ||= {}).bake = e.checked; });
    return out;
};

test.use({ viewport: { width: 1400, height: 1000 } });

test('S4a — the modal READS the cam_table: frate/dfeed Expose (from the blocks), ddepth Bake', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    await registerWithCamTable(page);
    await page.screenshot({ path: `${SCRATCH}/s4a-modal-camtable.png` });   // VIEWED — the block-driven modal rows
    const r = await page.evaluate(rowState);
    // the expose/bake state is READ from the cam_field blocks (camTableFromBindings: exposable→expose, geometry→bake)
    expect(r.frate, 'feed rate — the block says expose').toMatchObject({ expose: true, bake: false });
    expect(r.dfeed, 'drill feed (value, t1091) — the block says expose').toMatchObject({ expose: true, bake: false });
    expect(r.ddepth, 'drill depth (geometry) — the block says bake').toMatchObject({ expose: false, bake: true });
});

test('S4a — flipping a radio MUTATES the cam_field block AND the built slot reflects it (expose→#2600, bake→inline)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    await registerWithCamTable(page);
    // flip frate: Expose → Bake
    await page.click('.cam-auth-overlay .cbm-eb[data-fkey="frate"][data-mode="bake"]');
    const afterFlip = await page.evaluate(async () => {
        const { getUserDef, flattenBlocks } = await import('/blocks/userOps.js');
        const def = getUserDef('user_s4a_data');
        const rowOf = (p) => flattenBlocks(def.template).find((b) => b.type === 'cam_field' && b.params.param === p);
        return { frateMode: rowOf('frate').params.mode, dfeedMode: rowOf('dfeed').params.mode, ddepthMode: rowOf('ddepth').params.mode };
    });
    // the FLIP mutated the block (one source) — not a parallel decl
    expect(afterFlip.frateMode, 'the frate cam_field block is now bake').toBe('bake');
    expect(afterFlip.dfeedMode, 'dfeed is untouched (still expose)').toBe('expose');
    expect(afterFlip.ddepthMode, 'ddepth is untouched (still bake)').toBe('bake');
    // now BUILD and confirm the slot reflects the block: frate baked (no #2600), dfeed still exposed (#2600)
    await page.click('[data-act="cbm-build"]');
    await page.waitForSelector('.cam-sim-overlay [data-cbm="ok"]', { timeout: 8000 });
    await page.click('.cam-sim-overlay [data-cbm="ok"]');
    await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
    const slot = await page.evaluate(() => {
        const pack = JSON.parse(localStorage.getItem('ddcs_campack') || '{"slots":[]}');
        const s = pack.slots.slice(-1)[0] || {};
        return { keys: (s.fields || []).map((f) => f.key), body: s.body };
    });
    // frate is now baked → NOT a field, NO #2600 mirror for it; dfeed stays exposed → a field + its mirror
    expect(slot.keys, 'frate dropped from the fields (baked), dfeed remains exposed').toEqual(['dfeed']);
    expect(slot.body, 'no #2600 mirror named Feed rate (frate is baked)').not.toMatch(/;Feed rate/);
    expect(slot.body, 'dfeed still reads its #2600 mirror').toMatch(/;Cut feed/);
    expect(slot.body, 'the baked frate inlines its literal feed (F200), no #var').toMatch(/F200\b/);
});

test('S4a — editing a value writes to the cam_field block (the pendant default), which the build reads', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    await registerWithCamTable(page);
    // type a new pendant default for the exposed dfeed
    const input = page.locator('.cam-auth-overlay tr[data-fkey="dfeed"] input.cbm-val');
    await input.fill('444');
    await input.dispatchEvent('input');
    const r = await page.evaluate(async () => {
        const { getUserDef, flattenBlocks } = await import('/blocks/userOps.js');
        const def = getUserDef('user_s4a_data');
        const row = flattenBlocks(def.template).find((b) => b.type === 'cam_field' && b.params.param === 'dfeed');
        return { dflt: row.params.dflt };
    });
    expect(r.dflt, 'the value edit wrote the pendant default to the cam_field block').toBe('444');
});
