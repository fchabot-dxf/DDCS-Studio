import { test, expect } from './support/harness.mjs';

// Sub-stack S3 — the FORK PATH declares opunit. At fork/LOAD time (editWizardDef), a RECOGNIZED generator twin (surfacing/
// corner/…) opened to customize has its exec atoms WRAPPED in an opunit(opType, defV) so subStackToSlot keeps the standard
// part LIVE. A genuine custom op is NOT wrapped. opunit is emit-transparent → the forked op's own emit is byte-identical.
//
// TIER MIGRATION WORK PACKAGE 4 — moved browser→node: both tests are plain page.evaluate calls that import app modules,
// call fork/emit functions, and assert on plain returned data — no DOM read, no click, no screenshot. Both read the
// REAL surfacing twin via getUserDef('user_surfacing_data'); the node tier's page.goto stub never runs app.js's
// seedDefaultPortedUserOps(), so surfacing is registered explicitly first. wrapRecognizedForFork stamps the opunit's
// defV via defVOf(opType), which reads the PERSISTED store (not the live registry) — so seeding must go through
// createUserOp (guarded by an existence check, since node persists module state across tests in one process), not a
// bare registerUserOp. The file's third test (round-trips the opunit through the real Blockly workspace + reads block
// fields) depends on window.showApp/ddcsLoadBlockStack/window.__blkws — a genuine app+DOM dependency, not a candidate
// for this tier. Split into tests/cam-substack-fork-drive.spec.js.

test('S3 fork-wrap: wrapRecognizedForFork wraps a recognized twin exec atoms in opunit; a custom op is untouched; emit byte-identical', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { wrapRecognizedForFork } = await import('/blocks/devMode.js');
        const { getUserDef, userOpFromStack, registerUserOp, createUserOp, listUserOps } = await import('/blocks/userOps.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');
        const { surfacingDataDef } = await import('/blocks/dataOps/surfacingData.js');
        // node tier: page.goto doesn't run app.js's seedDefaultPortedUserOps(); wrapRecognizedForFork reads defV via
        // defVOf, which reads the PERSISTED store, so this must createUserOp (not a bare registerUserOp)
        if (!listUserOps().some((d) => d.opType === 'user_surfacing_data')) createUserOp(surfacingDataDef());

        // (A) a RECOGNIZED twin (surfacing) → its exec atoms wrapped in one opunit boundary
        const surfDef = getUserDef('user_surfacing_data');
        const w = wrapRecognizedForFork(surfDef);
        const root = w.template.find((b) => b.type === 'user_root');
        const opunit = root.children[0];

        // (B) opunit is emit-transparent → the wrapped template emits BYTE-IDENTICAL to the unwrapped
        const emitOf = (tpl) => emitMapped(tpl, activeDialectOpts()).text;
        const wrappedEmit = emitOf(w.template), unwrappedEmit = emitOf(surfDef.template);

        // (C) a CUSTOM (non-recognized) op → NOT wrapped
        const customDef = userOpFromStack('u_frk_custom', 'Custom', [{ type: 'user_root', params: {}, children: [
            { type: 'feed', params: { rate: 200 } }, { type: 'move', params: { mode: 'cut', z: -1 } },
        ] }], []);
        registerUserOp(customDef);
        const wc = wrapRecognizedForFork(customDef);

        return {
            recognized: w.recognized, opunitType: opunit.type, opunitOpType: opunit.params.opType,
            opunitDefV: opunit.params.defV, opunitChildCount: opunit.children.length, rootChildCount: root.children.length,
            wrappedEqualsUnwrapped: wrappedEmit === unwrappedEmit,
            customRecognized: wc.recognized, customWrapped: wc.template[0].children[0] && wc.template[0].children[0].type === 'opunit',
        };
    });
    // the recognized surfacing twin: its exec run collapses into ONE opunit child of user_root
    expect(r.recognized, 'surfacing is a recognized generator → wrapped').toBe(true);
    expect(r.rootChildCount, 'user_root now has ONE child: the opunit').toBe(1);
    expect(r.opunitType).toBe('opunit');
    expect(r.opunitOpType, 'the opunit declares the forked-from twin').toBe('user_surfacing_data');
    expect(r.opunitDefV, 'the opunit stamps the twin defV').toBeGreaterThanOrEqual(1);
    expect(r.opunitChildCount, 'the surfacing top-level exec atoms are inside the opunit (progstart/wcs/placeonstock/progend/entry/toolsel; stepdown+surfacefill nest in placeonstock)').toBe(6);
    // opunit transparent → wrapping changes NOTHING at emit
    expect(r.wrappedEqualsUnwrapped, 'opunit is transparent → wrapping is byte-identical at emit').toBe(true);
    // a genuine custom op is NOT a recognized generator → not wrapped
    expect(r.customRecognized, 'a custom op → not recognized → not wrapped').toBe(false);
    expect(r.customWrapped, 'custom op template unchanged (no opunit)').toBe(false);
});

test('S3 fork-wrap end-to-end: wrapped surfacing + added loose atoms → subStackToSlot keeps surfacing LIVE + the added values exposed', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { wrapRecognizedForFork } = await import('/blocks/devMode.js');
        const { getUserDef, flattenBlocks, createUserOp, listUserOps } = await import('/blocks/userOps.js');
        const { subStackToSlot } = await import('/data/subStackToSlot.js');
        const { surfacingDataDef } = await import('/blocks/dataOps/surfacingData.js');
        // node tier: page.goto doesn't run app.js's seedDefaultPortedUserOps(); createUserOp (not registerUserOp) so
        // defVOf resolves the twin's version (readStore-backed) the same way wrapRecognizedForFork expects
        if (!listUserOps().some((d) => d.opType === 'user_surfacing_data')) createUserOp(surfacingDataDef());

        // simulate the fork: wrap surfacing, then the user adds a feed + move AROUND the opunit boundary (loose siblings after it)
        const surfDef = getUserDef('user_surfacing_data');
        const w = wrapRecognizedForFork(surfDef);
        const root = w.template.find((b) => b.type === 'user_root');
        const feedBlk = { type: 'feed', params: { rate: 300 } };
        const moveBlk = { type: 'move', params: { mode: 'cut', z: -2 } };
        root.children.push(feedBlk, moveBlk);
        const def = { opType: 'user_forked_surfacing', template: w.template, bindings: [] };
        const flat = flattenBlocks(def.template);
        def.bindings = [
            { param: 'cfeed', blockIndex: flat.indexOf(feedBlk), key: 'rate', label: 'Feed', type: 'number', default: 300 },
            { param: 'cz', blockIndex: flat.indexOf(moveBlk), key: 'z', label: 'Plunge Z', type: 'number', default: -2 },
        ];
        const slot = subStackToSlot(def);
        const byKey = {}; (slot.fields || []).forEach((f) => { byKey[f.key] = f; });
        return { body: slot.body, hasWhile: /WHILE #\d+ LT #\d+ DO2/.test(slot.body), rowCount: slot.body.includes(';raster row count'),
            cfeed: byKey.cfeed || null, cz: byKey.cz || null };
    });
    // the wrapped surfacing stays a LIVE loop (subStackToSlot walks the opunit → its generator, NOT unrolled)
    expect(r.hasWhile, 'the wrapped surfacing sub-unit stays a LIVE WHILE loop').toBe(true);
    expect(r.rowCount, 'the surfacing raster row count is live').toBe(true);
    // the added loose atoms are exposed as #vars
    expect(r.cfeed, 'the added feed is exposed').toBeTruthy();
    expect(r.cz, 'the added plunge Z is exposed').toBeTruthy();
    expect(r.body).toContain(`F${r.cfeed.var}`);
    expect(r.body).toContain(`Z${r.cz.var}`);
});
