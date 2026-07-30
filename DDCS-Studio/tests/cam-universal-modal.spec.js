import { test, expect } from '@playwright/test';

// Universal CAM U3 (the VISIBLE milestone): a forked/custom op (user_* with no generator) opens the REAL CAM authoring modal
// via the op-card "Build CAM slot" door. The expose/bake table renders with value params (feed/coord/Z) EXPOSABLE and
// geometry params (num()-consumed drill) Expose-DISABLED / bake-forced, and Build produces a slot with the exposed #vars.
const SCRATCH = 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad';

test('U3 modal: a forked custom op → op-card Build CAM slot → value params exposable, geometry greyed bake-only → Build', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);

    // register a forked custom op (Feed + Move cut = value params; Drill = num()-consumed geometry) + place it in the program
    await page.evaluate(async () => {
        const { userOpFromStack, registerUserOp } = await import('/blocks/userOps.js');
        const stack = [{ type: 'user_root', params: {}, uiChildren: [{ type: 'param_group', params: { group: 'Cut' }, children: [] }], children: [
            { type: 'feed', params: { rate: 200 } },
            { type: 'move', params: { mode: 'cut', x: 10, y: 20, z: -3, feed: 500 } },
            { type: 'holecycle', params: { pattern: 'single', cycle: 'peck', x0: 0, y0: 0, depth: 5, peck: 5, feed: 100 } },
        ] }];
        const bindings = [
            { param: 'frate', blockIndex: 2, key: 'rate', label: 'Feed', units: 'mm/min', type: 'number', default: 200 },
            { param: 'mx', blockIndex: 3, key: 'x', label: 'X', type: 'number', default: 10 },
            { param: 'mz', blockIndex: 3, key: 'z', label: 'Plunge Z', type: 'number', default: -3 },
            { param: 'mmode', blockIndex: 3, key: 'mode', label: 'Cut mode', type: 'string', default: 'cut' },   // an 'other' (string) param → baked, read-only cell
            { param: 'dfeed', blockIndex: 4, key: 'feed', label: 'Drill feed', type: 'number', default: 100 },
            { param: 'ddepth', blockIndex: 4, key: 'depth', label: 'Drill depth', type: 'number', default: 5 },
        ];
        registerUserOp(userOpFromStack('u3_modal_data', 'Custom Cut', stack, bindings));
        window.__op = { id: 'uop1', type: 'op', opType: 'user_u3_modal_data', label: 'Custom Cut', params: { frate: 250, mx: 15, mz: -4, mmode: 'cut', dfeed: 120, ddepth: 6 } };
        window.ddcsGetBlockProgram = () => [window.__op];
    });

    // open the modal via the op-card door (the same window.ddcsOpenCamAuthoring the ▸ Build CAM slot action calls)
    await page.evaluate(async () => { (await import('/ui/macrosApp.js')).initMacrosApp(); window.ddcsOpenCamAuthoring(window.__op); });
    await page.waitForSelector('.cam-auth-overlay .cbm-eb');

    // the expose/bake state per row: value params Expose-enabled+checked; geometry params Expose-DISABLED + Bake-forced
    const out = await page.evaluate(() => {
        const cell = (key, mode) => document.querySelector(`.cbm-eb[data-fkey="${key}"][data-mode="${mode}"]`);
        const valTag = (key) => { const td = document.querySelector(`#cbm_table tr[data-fkey="${key}"] td:nth-child(2)`); return td && td.firstElementChild ? td.firstElementChild.tagName : null; };
        const rows = ['frate', 'mx', 'mz', 'mmode', 'dfeed', 'ddepth'].map((k) => ({ key: k,
            exposeDisabled: !!(cell(k, 'expose') && cell(k, 'expose').disabled),
            exposeChecked: !!(cell(k, 'expose') && cell(k, 'expose').checked),
            bakeChecked: !!(cell(k, 'bake') && cell(k, 'bake').checked) }));
        return { rows, modeValTag: valTag('mmode'), feedValTag: valTag('frate') };
    });
    const by = Object.fromEntries(out.rows.map((r) => [r.key, r]));

    await page.screenshot({ path: `${SCRATCH}/cam-universal-modal.png` });   // VIEWED (ACCEPT, gated to the advisor)

    // value params (val() ride-through) — EXPOSABLE, exposed by default
    expect(by.frate, 'feed = value → Expose enabled + checked').toMatchObject({ exposeDisabled: false, exposeChecked: true });
    expect(by.mx, 'move X = value → Expose enabled').toMatchObject({ exposeDisabled: false });
    expect(by.mz, 'plunge Z = value → Expose enabled + checked').toMatchObject({ exposeDisabled: false, exposeChecked: true });
    // t1091 — drill FEED now rides val() → Expose ENABLED in the modal (pure F# interpolation). drill DEPTH drives the peck
    // loop → still geometry, Expose DISABLED + Bake forced (the greyed-geometry example this test guards).
    expect(by.dfeed, 'drill feed = value (t1091) → Expose enabled').toMatchObject({ exposeDisabled: false });
    expect(by.ddepth, 'the hole depth is a register seed now → Expose ENABLED in the modal (t1391)').toMatchObject({ exposeDisabled: false });   // t1391 — the hole depth is a live #81 register seed now (t1389 val()), not a JS loop bound: the classifier's answer INVERTS with the mechanism
    // Bug #2 fix — a baked STRING param (mode) is Expose-disabled and its value cell is a READ-ONLY span (not a corruptible number input)
    expect(by.mmode, 'string mode param → Expose disabled, baked').toMatchObject({ exposeDisabled: true, bakeChecked: true });
    expect(out.modeValTag, 'baked string value → read-only SPAN, not an editable number input').toBe('SPAN');
    expect(out.feedValTag, 'numeric value → editable number INPUT').toBe('INPUT');

    // ▶ Simulate — the unrolled universal slot renders its motion in the inline preview (a canvas mounts)
    await page.click('[data-act="cbm-sim"]');
    await page.waitForSelector('#cbm_preview canvas', { state: 'attached', timeout: 8000 });
    await page.waitForTimeout(1200);   // let the toolpath draw
    await page.screenshot({ path: `${SCRATCH}/cam-universal-sim.png` });
    expect(await page.evaluate(() => !!document.querySelector('#cbm_preview canvas')), 'the universal slot simulates (canvas mounts)').toBe(true);

    // Build → a slot whose body carries the exposed #vars (feed + plunge Z) and bakes the geometry
    await page.click('[data-act="cbm-build"]');
    await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
    const slotBody = await page.evaluate(() => {
        const pack = JSON.parse(localStorage.getItem('ddcs_campack') || '{"slots":[]}');
        return (pack.slots.slice(-1)[0] || {}).body || '';
    });
    expect(slotBody, 'exposed feed → F#var in the built slot').toMatch(/F#\d/);
    expect(slotBody, 'exposed plunge Z → Z#var in the built slot').toMatch(/Z#\d/);

    // Bug #3 fix — the saved op carries type='universal', so opCardsHtml renders it as a read-only "Custom op" (NOT a "Drill"
    // type dropdown that would silently convert it). Data-level check (the render conditional keys off op.type).
    const savedOpType = await page.evaluate(() => {
        const pack = JSON.parse(localStorage.getItem('ddcs_campack') || '{"slots":[]}');
        const slot = pack.slots.slice(-1)[0];
        return slot && slot.ops && slot.ops[0] ? slot.ops[0].type : null;
    });
    expect(savedOpType, 'the saved universal op carries type=universal → op-card renders it read-only').toBe('universal');
});
