import { test, expect } from './support/harness.mjs';

// BLOCK-NATIVE CAM PARAMS S5.3 — the FORM materialize HOOK (analog of S4b). maybeMaterializeParamGroup at editWizardDef gives
// a pill-based op its form fields as param_field blocks (a param_group), composing with the S4b cam_table materialize. The
// CANVAS-widget decision: CARRIED (option a) — formBindings preserves a canvas binding's group/role/widget, so a materialized
// param_group is byte-neutral even for a canvas op (no skip needed). Byte-neutral form + emit; bindings resolve after the
// combined shift; literal twins skipped (no pills, inherited from S4b).
//
// TIER MIGRATION WORK PACKAGE 3 — split browser→node. 4 of the 5 tests are pure: import()+evaluate over
// /ui/formWidgets.js + /blocks/userOps.js + /data/opCamMap.js + /data/stackToSlot.js + /blocks/devMode.js +
// /blocks/blockEmitter.js + /wizards/previewEmit.js, constructing their own synthetic op defs and asserting on
// plain returned data — no DOM. The 5th ("S5.3 integration — editWizardDef materializes BOTH…") stayed in the
// browser tier (tests/cam-block-native-params-s53-drive.spec.js): it drives `window.ddcsEditWizardDef` and reads
// a live Blockly workspace (`window.__blkws.getAllBlocks(false)`) — a genuine app+DOM+Blockly dependency.

// a PILL-based op with a CANVAS group (x0/y0 = an xy-pad) + a plain feed — the byte-neutral trap.
const canvasDef = () => ({
    opType: 'user_s53canvas', label: 'S53 Canvas',
    template: [{ type: 'user_root', params: {}, children: [
        { type: 'move', params: { mode: 'cut', x: { type: 'param', params: { name: 'x0', value: 0 } }, y: { type: 'param', params: { name: 'y0', value: 0 } }, z: -3, feed: 500 } },
        { type: 'feed', params: { rate: { type: 'param', params: { name: 'frate', value: 200 } } } },
    ] }],
    bindings: [
        { param: 'x0', blockIndex: 1, key: 'x', type: 'number', default: 0, label: 'X', group: 'pg1', role: 'x', widget: 'xy-pad' },
        { param: 'y0', blockIndex: 1, key: 'y', type: 'number', default: 0, label: 'Y', group: 'pg1', role: 'y' },
        { param: 'frate', blockIndex: 2, key: 'rate', type: 'number', default: 200, label: 'Feed', units: 'mm/min' },
    ],
});
const formShape = (fb) => fb.map((b) => ({ param: b.param, key: b.key, label: b.label, widget: b.widget, default: b.default, group: b.group, role: b.role }));

test('S5.3 — materializeParamGroup is BYTE-NEUTRAL for the FORM, incl. CANVAS grouping (group/role/widget preserved)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { formBindings, resolveFormWidget } = await import('/ui/formWidgets.js');
        const { materializeParamGroup, flattenBlocks } = await import('/blocks/userOps.js');
        const base = new Function('return ' + mk)()();
        const before = formBindings(base);   // fallback (no param_group) — the raw bindings
        const mat = new Function('return ' + mk)()();
        materializeParamGroup(mat);
        const after = formBindings(mat);      // consumed via the materialized param_group
        // byte-neutral = the RENDERED form: the label/default/group/role/order identical AND each field resolves to the SAME
        // widget (undefined and 'number' resolve to the same number widget — render-identical, so that difference is cosmetic).
        const shape = (fb) => fb.map((b) => ({ param: b.param, key: b.key, label: b.label, default: b.default, group: b.group, role: b.role }));
        const widgetsMatch = before.length === after.length && before.every((b, i) => resolveFormWidget(b) === resolveFormWidget(after[i]));
        // t2543 (BACKLOG #71 owner ruling) — SEPARATE SLOT: materialize now injects `param_table`, never `param_group`.
        return { before: shape(before), after: shape(after), widgetsMatch, x0w: after[0].widget, x0g: after[0].group, x0r: after[0].role, y0g: after[1].group, y0r: after[1].role, hasPg: flattenBlocks(mat.template).some((b) => b.type === 'param_table') };
    }, canvasDef.toString());
    expect(r.hasPg, 'a param_table was materialized').toBe(true);
    // the CANVAS group is intact: x0 keeps its xy-pad widget + group/role, y0 keeps its group/role, order preserved
    expect(r.after, 'label/default/group/role/order byte-identical to today — canvas grouping NOT flattened').toEqual(r.before);
    expect(r.widgetsMatch, 'every field resolves to the SAME rendered widget').toBe(true);
    expect({ w: r.x0w, g: r.x0g, r: r.x0r }, 'x0 keeps its canvas widget + group/role').toEqual({ w: 'xy-pad', g: 'pg1', r: 'x' });
    expect({ g: r.y0g, r: r.y0r }, 'y0 keeps its group/role (canvas member)').toEqual({ g: 'pg1', r: 'y' });
});

test('S5.3 — composes with S4b: cam_table + param_group both inject; bindings resolve BY IDENTITY after the combined shift', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { formBindings } = await import('/ui/formWidgets.js');
        const { materializeParamGroup, flattenBlocks } = await import('/blocks/userOps.js');
        const { materializeCamTable } = await import('/data/opCamMap.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const base = new Function('return ' + mk)()();
        const beforeForm = formBindings(base);
        const combined = new Function('return ' + mk)()();
        materializeCamTable(combined);      // S4b — inject a cam_table + identity re-derive
        materializeParamGroup(combined);    // S5.3 — inject a param_group + identity re-derive over the NEW flatten
        // both blocks present; every binding's ORIGINAL block is still found at its (re-derived) index
        const flat = flattenBlocks(combined.template);
        const resolve = combined.bindings.every((b) => { const blk = flat[b.blockIndex]; return blk && blk.type === (b.key === 'rate' ? 'feed' : 'move'); });
        return {
            // t2543 — param_table, not param_group (materialize's own separate target)
            hasBoth: flat.some((b) => b.type === 'cam_table') && flat.some((b) => b.type === 'param_table'),
            resolve,
            formSame: JSON.stringify(formBindings(combined).map((b) => ({ p: b.param, g: b.group, r: b.role }))) === JSON.stringify(beforeForm.map((b) => ({ p: b.param, g: b.group, r: b.role }))),
            slotOk: stackToSlot(combined, {}, new Set(), 0).body.length > 0,
        };
    }, canvasDef.toString());
    expect(r.hasBoth, 'both a cam_table AND a param_group were injected').toBe(true);
    expect(r.resolve, 'every binding still resolves to its original socket after the COMBINED shift (identity re-derive)').toBe(true);
    expect(r.formSame, 'the form is still byte-neutral through the combined injection').toBe(true);
    expect(r.slotOk, 'the universal build still works through the cam_table').toBe(true);
});

test('S5.3 — maybeMaterializeParamGroup: a pill op materializes; a literal op is SKIPPED; already-has-one is idempotent', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { maybeMaterializeParamGroup } = await import('/blocks/devMode.js');
        const { flattenBlocks } = await import('/blocks/userOps.js');
        // t2543 — param_table, not param_group (materialize's own separate target)
        const has = (def) => flattenBlocks(def.template).filter((b) => b.type === 'param_table').length;
        const pill = new Function('return ' + mk)()();
        maybeMaterializeParamGroup(pill);
        const idem = has(pill); maybeMaterializeParamGroup(pill); const idem2 = has(pill);   // idempotent
        // a LITERAL op (no pills) → skipped
        const lit = { opType: 'user_s53lit', label: 'Lit', template: [{ type: 'user_root', params: {}, children: [{ type: 'feed', params: { rate: 200 } }] }], bindings: [{ param: 'frate', blockIndex: 1, key: 'rate', type: 'number', default: 200, label: 'Feed' }] };
        maybeMaterializeParamGroup(lit);
        return { pillHas: has(pill), idem, idem2, litHas: has(lit) };
    }, canvasDef.toString());
    expect(r.pillHas, 'a pill op gets a param_group').toBe(1);
    expect(r.idem === 1 && r.idem2 === 1, 'idempotent — a second call is a no-op').toBe(true);
    // t1632 — the S6 gate ARRIVED EARLY, by intent: b95540d9 deleted the hasParamPills guard so LITERAL twins
    // materialize too (the fix's stated purpose — built-in wizards presenting a populated form in Blocks). The
    // old "SKIPPED" pin is the pre-b95540d9 world; the new pin is that the literal op materializes AND stays
    // idempotent like the pill op.
    expect(r.litHas, 'a LITERAL op materializes too — the S6 gate arrived early (b95540d9)').toBe(1);
});

test('S5.3 — emit is BYTE-IDENTICAL through the materialized param_group (param_field + param_group emit [])', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { materializeParamGroup } = await import('/blocks/userOps.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');
        const base = new Function('return ' + mk)()();
        const emitBefore = emitMapped(base.template, activeDialectOpts()).text;
        const mat = new Function('return ' + mk)()();
        materializeParamGroup(mat);
        const emitAfter = emitMapped(mat.template, activeDialectOpts()).text;
        return { same: emitBefore === emitAfter, hasF: /F500/.test(emitAfter) };
    }, canvasDef.toString());
    expect(r.same, 'materializing a param_group changes not one byte of emit').toBe(true);
    expect(r.hasF, 'and the real atoms still emit').toBe(true);
});
