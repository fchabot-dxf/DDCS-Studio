import { test, expect } from '@playwright/test';

const SCRATCH = 'scratchpad';

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
            { type: 'holecycle', params: { pattern: 'single', cycle: 'peck', x0: 0, y0: 0, depth: 5, peck: 2, feed: 300, clearance: 5 } },
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
    expect(r.ddepth, 'the hole depth is a register seed now — the block says EXPOSE (t1391)').toMatchObject({ expose: true, bake: false });   // t1391 — the hole depth is a live #81 register seed now (t1389 val()), not a JS loop bound: the classifier's answer INVERTS with the mechanism
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
    // t1391 — ddepth's OWN default is now 'expose' (the hole depth became a live register seed). The claim here is
    // untouched-ness, not the value: flipping frate must not disturb its neighbours, whatever their modes happen to be.
    expect(afterFlip.ddepthMode, 'ddepth is untouched by the frate flip (its own default is expose since t1389)').toBe('expose');
    // now BUILD and confirm the slot reflects the block: frate baked (no #2600), dfeed still exposed (#2600)
    await page.click('[data-act="cbm-build"]');
    await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
    const slot = await page.evaluate(() => {
        const pack = JSON.parse(localStorage.getItem('ddcs_campack') || '{"slots":[]}');
        const s = pack.slots.slice(-1)[0] || {};
        return { keys: (s.fields || []).map((f) => f.key), body: s.body };
    });
    // frate is now baked -> NOT a field, NO #2600 mirror for it; dfeed stays exposed -> a field + its mirror.
    // t1391 — ddepth JOINS the exposed fields, and that is the switch showing through rather than a loosened assert:
    // the hole depth became a live #81 register seed (t1389 val()), so the classifier's default for it is expose. The
    // list is kept EXACT (pre-order) rather than relaxed to a contains-check, so a future stray field still fails here.
    expect(slot.keys, 'frate dropped from the fields (baked); dfeed + the now-exposable ddepth remain').toEqual(['ddepth', 'dfeed']);
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
