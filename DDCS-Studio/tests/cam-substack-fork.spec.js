import { test, expect } from '@playwright/test';

const SCRATCH = 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad';

// Sub-stack S3 — the FORK PATH declares opunit. At fork/LOAD time (editWizardDef), a RECOGNIZED generator twin (surfacing/
// corner/…) opened to customize has its exec atoms WRAPPED in an opunit(opType, defV) so subStackToSlot keeps the standard
// part LIVE. A genuine custom op is NOT wrapped. opunit is emit-transparent → the forked op's own emit is byte-identical.

test('S3 fork-wrap: wrapRecognizedForFork wraps a recognized twin exec atoms in opunit; a custom op is untouched; emit byte-identical', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { wrapRecognizedForFork } = await import('/blocks/devMode.js');
        const { getUserDef, userOpFromStack, registerUserOp } = await import('/blocks/userOps.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');

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
        const { getUserDef, flattenBlocks } = await import('/blocks/userOps.js');
        const { subStackToSlot } = await import('/data/subStackToSlot.js');

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

test.describe(() => {
    test.use({ viewport: { width: 1400, height: 1000 } });
    test('S3 fork-wrap: the opunit round-trips through the Blockly workspace (its exec children survive) + renders a visible chip', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsLoadBlockStack && window.showApp && window.ddcsGetBlockProgram);
        await page.evaluate(() => window.showApp('blocks'));
        await page.evaluate(async () => {
            const OB = await import('/blocks/opBuilders.js');
            const { wrapRecognizedForFork } = await import('/blocks/devMode.js');
            const { getUserDef, defaultParams } = await import('/blocks/userOps.js');
            const surfDef = getUserDef('user_surfacing_data');
            const w = wrapRecognizedForFork(surfDef);
            window.ddcsLoadBlockStack([OB.makeOp('user_surfacing_data', defaultParams(surfDef), w.template)]);
        });
        // the opunit block RENDERS on the canvas (the DO-mouth fix) — else this times out
        await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).some((b) => b.type === 'opunit'));
        await page.waitForTimeout(400);
        const r = await page.evaluate(async () => {
            const { workspaceToStack } = await import('/blocks/blockly/stackBridge.js');
            const back = workspaceToStack(window.__blkws);
            let opunit = null;
            const walk = (bs) => { for (const b of (bs || [])) { if (!b) continue; if (b.type === 'opunit') opunit = b; if (b.uiChildren) walk(b.uiChildren); if (b.children) walk(b.children); } };
            walk(back);
            return { hasOpunit: !!opunit, opunitOpType: opunit && opunit.params && opunit.params.opType, opunitChildCount: opunit ? (opunit.children || []).length : 0 };
        });
        await page.screenshot({ path: `${SCRATCH}/s3-opunit-chip.png` });   // VIEW how the opunit chip renders
        // the DO-mouth fix (bridge.js + stackBridge.js) — the opunit keeps its exec children through the workspace round-trip
        expect(r.hasOpunit, 'the opunit survives the workspace round-trip').toBe(true);
        expect(r.opunitOpType).toBe('user_surfacing_data');
        expect(r.opunitChildCount, 'the opunit keeps its 6 exec children through the round-trip (NOT dropped)').toBe(6);
    });
});
