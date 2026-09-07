import { test, expect } from './support/harness.mjs';

/**
 * COMPOSABLE-WIZARD-AUTHORING PILOT 1 (t397) — the FORM value-field BLOCK. A `formfield` block in the user_root
 * PRESENTATION mouth is the blocks-native twin of a deriveBindings SPEC row: bindingsFromStack (forward) + bindingsToBlocks
 * (reverse) round-trip def.bindingSpecs ⇄ blocks LOSSLESSLY (mirrors simStartsFromStack/ToBlocks). resolveBindingsMeta in
 * registerUserOp derives def.bindingSpecs (emit) + def.bindings (form) from the blocks; isMaintainedAsData lifts once every
 * spec is authored as a block. VERIFY (assert-the-value): lossless round-trip · derived bindings · value lands + emit ·
 * renders in the live form · the lock lifts · the block RENDERS (Class-B guard).
 *
 * t1512 (tier migration): SPLIT off browser→node. The 4 tests here are pure module calls (bindingsToBlocks/
 * bindingsFromStack/registerUserOp/isMaintainedAsData) asserted on plain returned data. The 5th test ("DRIVE THE APP")
 * opens a real wizard form + Blockly workspace and queries rendered DOM — stayed in formfield-block-drive.spec.js.
 */

const PILOT_OPTYPE = 'user_ff_pilot';

test('LOSSLESS round-trip: bindingsFromStack(bindingsToBlocks(MIDDLE_BINDING_SPECS)) === the original specs (section/help/when/match/readonly/optional all preserved)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio || window.ddcsGetSettings || true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const { MIDDLE_BINDING_SPECS } = await import('/blocks/dataOps/middleData.js');
        const blocks = U.bindingsToBlocks(MIDDLE_BINDING_SPECS);
        const back = U.bindingsFromStack(blocks);
        return { original: MIDDLE_BINDING_SPECS, back, nBlocks: blocks.length, allFormfield: blocks.every((b) => b.type === 'formfield') };
    });
    expect(r.allFormfield, 'every spec renders as a formfield block').toBe(true);
    expect(r.nBlocks, 'one block per value spec (all have a match)').toBe(r.original.length);
    // the round-tripped specs deep-equal the hand-written originals (order-independent per key; array order preserved)
    expect(r.back, 'the round-trip is byte-lossless — section/help/when/match/readonly/optional/default all survive').toEqual(r.original);
});

test('t2133 LOSSLESS round-trip: formHidden/group/role/relTo/optionGate (the canvas-drag triple + the reused per-option gate) survive bindingsToBlocks->bindingsFromStack, byte-identical to a hand-written spec (e.g. corner\'s cross1_x/y)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio || window.ddcsGetSettings || true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        // mirrors CORNER_BINDING_SPECS' own shape: a formHidden drag-handle pair (group+role+relTo) and a value
        // field carrying a per-option gate (clearMode's own optionGate) — the two mechanisms this turn declares.
        const specs = [
            { param: 'cross1_x', type: 'number', formHidden: true, group: 'reposition', role: 'x', relTo: { row: 'wall1' }, label: 'Wall 2 dX', section: 'GEOMETRY', match: { type: 'assign', var: '#23' }, key: 'value' },
            { param: 'cross1_y', type: 'number', formHidden: true, group: 'reposition', role: 'y', relTo: { row: 'wall1' }, label: 'Wall 2 dY', section: 'GEOMETRY', match: { type: 'assign', var: '#24' }, key: 'value' },
            { param: 'clearMode', type: 'enum', label: 'Clearance', section: 'GEOMETRY', match: { type: 'clearlift' }, key: 'clearMode', optionGate: { option: 'plane', requireAll: [{ param: 'wcs', is: 'active' }], fallback: 'hop', tip: 'needs Active WCS' } },
        ];
        const blocks = U.bindingsToBlocks(specs);
        const back = U.bindingsFromStack(blocks);
        return { original: specs, back, allFormfield: blocks.every((b) => b.type === 'formfield') };
    });
    expect(r.allFormfield, 'every spec (incl. the formHidden pair) renders as a formfield block').toBe(true);
    expect(r.back, 'formHidden/group/role/relTo/optionGate round-trip byte-lossless, same as section/help/when/match already did').toEqual(r.original);
});

test('a formfield-authored op: registerUserOp DERIVES def.bindingSpecs (emit) + def.bindings (form) from the blocks; the value LANDS + emit reflects it', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (OPTYPE) => {
        const U = await import('/blocks/userOps.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        localStorage.removeItem('ddcs_user_ops');
        try { U.deleteUserOp(OPTYPE); } catch (_) {}
        // author 3 form fields as blocks, bound to #1/#2/#3 (a section + help + a units widgetConfig)
        const specs = [
            { param: 'dist',    type: 'number', default: 30, label: 'Max Probe Dist', help: 'how far', section: 'CUT', match: { type: 'assign', var: '#1' }, key: 'value', widgetConfig: { min: 1, max: 200, units: 'mm' } },
            { param: 'retract', type: 'number', default: 2,  label: 'Retract',        help: 'back off', section: 'CUT', match: { type: 'assign', var: '#2' }, key: 'value' },
            { param: 'feed',    type: 'number', default: 200, label: 'Feed',          section: 'CUT', match: { type: 'assign', var: '#3' }, key: 'value' },
        ];
        const template = [{
            type: 'user_root', params: {},
            uiChildren: [
                { type: 'feature_canvas', params: { panel: 'form' } },
                { type: 'param_group', params: { group: 'Pilot' }, children: U.bindingsToBlocks(specs) },
            ],
            children: [
                { type: 'assign', params: { var: '#1', value: 30 } },
                { type: 'assign', params: { var: '#2', value: 2 } },
                { type: 'assign', params: { var: '#3', value: 200 } },
            ],
        }];
        const def = U.userOpFromStack(OPTYPE, 'FF Pilot', template, [], 'form');
        U.createUserOp(def);
        const reg = U.listUserOps().find((d) => d.opType === OPTYPE);
        // build with a DIFFERENT dist → the value lands in #1 (via the derived bindingSpecs → instantiate)
        const emitDefault = emitMapped(builderOf(OPTYPE)(U.defaultParams(reg))).text;
        const emitOverride = emitMapped(builderOf(OPTYPE)({ ...U.defaultParams(reg), dist: 77 })).text;
        try { U.deleteUserOp(OPTYPE); } catch (_) {}
        localStorage.removeItem('ddcs_user_ops');
        return {
            hasSpecs: Array.isArray(reg.bindingSpecs) && reg.bindingSpecs.length === 3,
            formParams: (reg.bindings || []).map((b) => b.param),
            formHasBlockIndex: (reg.bindings || []).every((b) => typeof b.blockIndex === 'number'),
            distDefault: (reg.bindings.find((b) => b.param === 'dist') || {}).default,
            emitDefaultHas30: /#1=30\b/.test(emitDefault),
            emitOverrideHas77: /#1=77\b/.test(emitOverride),
            emitOverrideDist: (emitOverride.split('\n').find((l) => /^#1=/.test(l)) || ''),
        };
    }, PILOT_OPTYPE);
    expect(r.hasSpecs, 'def.bindingSpecs derived from the 3 formfield blocks').toBe(true);
    expect(r.formParams, 'def.bindings (the form) derived from the blocks, in order').toEqual(['dist', 'retract', 'feed']);
    expect(r.formHasBlockIndex, 'each derived binding resolved its flat blockIndex (by #var identity)').toBe(true);
    expect(r.distDefault, 'the derived default came from the block').toBe(30);
    expect(r.emitDefaultHas30, 'the default value lands in #1').toBe(true);
    expect(r.emitOverrideHas77, 'overriding the param lands the new value in #1 (the socket link works)').toBe(true);
    expect(r.emitOverrideDist, 'assert-the-value: #1 is exactly the override').toMatch(/^#1=77\b/);
});

test('isMaintainedAsData LIFTS for a formfield-authored def (lossless round-trip) but STAYS locked for a hand-written-spec port (middle)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio || true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const { isMaintainedAsData } = await import('/blocks/devMode.js');
        const { middleDataDef } = await import('/blocks/dataOps/middleData.js');
        // middle: hand-written bindingSpecs, NO formfield blocks in its template → STILL locked (byte-identical, unchanged)
        const middle = middleDataDef();
        const middleLocked = isMaintainedAsData(middle);
        // a formfield-authored def: every spec is a block → the round-trip is lossless → lock LIFTS
        const specs = [{ param: 'd', type: 'number', default: 5, match: { type: 'assign', var: '#1' }, key: 'value' }];
        const authored = { opType: 'user_x', template: [{ type: 'user_root', params: {}, uiChildren: U.bindingsToBlocks(specs), children: [{ type: 'assign', params: { var: '#1', value: 5 } }] }], bindingSpecs: specs, bindings: [] };
        const authoredLocked = isMaintainedAsData(authored);
        return { middleLocked, authoredLocked };
    });
    expect(r.middleLocked, 'middle (hand-written specs, no blocks) stays maintained-as-data → visual save refused').toBe(true);
    expect(r.authoredLocked, 'a formfield-authored def round-trips losslessly → the lock LIFTS → visual save works').toBe(false);
});
