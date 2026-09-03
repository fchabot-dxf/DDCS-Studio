import { test, expect } from '@playwright/test';

const SCRATCH = 'scratchpad';

// t1075 Part C — the placed-op → SAVE fork route must produce the SAME opunit sub-stack the Customize (editWizardDef)
// route does, so fork behaviour is ONE-SOURCE regardless of route. Gated on ALL of: recognized + not-already-opunit +
// the body's atom TYPE SEQUENCE still equal to the source exec run. The exposure blockIndex is re-derived BY IDENTITY
// over the wrapped flatten — never a blanket +1, because the shift is NON-UNIFORM (exec children shift, uiChildren
// panel/sim/param_group do NOT).

const loadPlacedDirect = async (page, opType) => {
    // load a PLACED op the DIRECT way (makeOp over the instantiated body, exactly like opSession previews it) —
    // NOT via editWizardDef/Customize, so there is no load-time opunit wrap.
    await page.evaluate(async (t) => {
        const OB = await import('/blocks/opBuilders.js');
        const { getUserDef, defaultParams, instantiate } = await import('/blocks/userOps.js');
        const def = getUserDef(t);
        const params = defaultParams(def);
        window.ddcsLoadBlockStack([OB.makeOp(t, params, instantiate(def, params))]);
    }, opType);
    await page.waitForTimeout(500);
};

const saveAs = async (page, name) => {
    await page.evaluate(() => window.ddcsSaveAsWizard());
    await page.fill('.blk-dev-savedlg .blk-dev-opname', name);
    await page.click('.blk-dev-savedlg .blk-dev-save');
    await page.waitForTimeout(400);
};

test('C unit — THE TRAP: the shift is NON-UNIFORM and every exposure is re-derived BY IDENTITY (a blanket +1 would corrupt a uiChild)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { wrapForkAtSave } = await import('/blocks/devMode.js');
        const { getUserDef, defaultParams, instantiate, flattenBlocks } = await import('/blocks/userOps.js');
        const def = getUserDef('user_surfacing_data');
        const params = defaultParams(def);
        const children = instantiate(def, params);
        const flatBefore = flattenBlocks(children);
        const execIdx = flatBefore.findIndex((b) => b && b.type === 'placeonstock');   // an EXEC atom → shifts
        const uiIdx = flatBefore.findIndex((b) => b && b.type === 'param_group');      // a uiChild → does NOT shift
        const execRef = flatBefore[execIdx], uiRef = flatBefore[uiIdx];
        const a = {
            opRec: { type: 'op', opType: 'user_surfacing_data', params, children },
            exposures: [
                { param: 'ex', blockIndex: execIdx, key: 'offX', default: 0 },
                { param: 'ui', blockIndex: uiIdx, key: 'group', default: '' },
            ],
        };
        const wrapped = wrapForkAtSave(a);
        const flatAfter = flattenBlocks(a.opRec.children);
        const root = a.opRec.children.find((b) => b && b.type === 'user_root');
        return {
            wrapped, execIdxBefore: execIdx, uiIdxBefore: uiIdx,
            execIdxAfter: a.exposures[0].blockIndex, uiIdxAfter: a.exposures[1].blockIndex,
            execResolves: flatAfter[a.exposures[0].blockIndex] === execRef,
            uiResolves: flatAfter[a.exposures[1].blockIndex] === uiRef,
            rootFirstType: ((root.children || [])[0] || {}).type, rootChildCount: (root.children || []).length,
        };
    });
    expect(r.wrapped, 'the wrap fires for an untouched recognized twin body').toBe(true);
    expect(r.rootFirstType, 'the exec run is wrapped in ONE opunit').toBe('opunit');
    expect(r.rootChildCount, 'user_root has exactly one child (the opunit)').toBe(1);
    // THE TRAP, demonstrated: the shift is NON-UNIFORM — a blanket +1 would silently corrupt the uiChild binding
    expect(r.execIdxAfter, 'an EXEC atom shifts by exactly one (the opunit precedes it)').toBe(r.execIdxBefore + 1);
    expect(r.uiIdxAfter, 'a uiChild (param_group) does NOT shift — a blanket +1 would corrupt it').toBe(r.uiIdxBefore);
    // …and both still resolve to the very same block RECORDS (identity, not arithmetic)
    expect(r.execResolves, 'the exec exposure resolves to the SAME block record').toBe(true);
    expect(r.uiResolves, 'the uiChild exposure resolves to the SAME block record').toBe(true);
});

test('C unit — the gates: not-recognized / already-opunit / atom added → NO wrap (save universal exactly as today)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { wrapForkAtSave, wrapRecognizedForFork } = await import('/blocks/devMode.js');
        const { getUserDef, defaultParams, instantiate, flattenBlocks, userOpFromStack, registerUserOp } = await import('/blocks/userOps.js');
        const def = getUserDef('user_surfacing_data');
        const params = defaultParams(def);
        const mk = (children, opType = 'user_surfacing_data', p = params) => ({ opRec: { type: 'op', opType, params: p, children }, exposures: [] });
        // (1) NOT recognized — a genuine universal custom op
        registerUserOp(userOpFromStack('c_gate_uni', 'Uni', [{ type: 'user_root', params: {}, children: [{ type: 'feed', params: { rate: 210 } }] }], []));
        const uniDef = getUserDef('user_c_gate_uni');
        const uni = mk(instantiate(uniDef, defaultParams(uniDef)), 'user_c_gate_uni', defaultParams(uniDef));
        const uniWrapped = wrapForkAtSave(uni);
        // (2) ALREADY opunit (the editWizardDef route) — must NOT double-wrap
        const already = mk(wrapRecognizedForFork(def).template);
        const alreadyWrapped = wrapForkAtSave(already);
        const alreadyNested = flattenBlocks(already.opRec.children).filter((b) => b && b.type === 'opunit').length;
        // (3) an ATOM ADDED to the exec run — un-identifiable → no wrap
        const edited = mk(instantiate(def, params));
        edited.opRec.children.find((b) => b.type === 'user_root').children.push({ type: 'feed', params: { rate: 300 } });
        const editedWrapped = wrapForkAtSave(edited);
        // (4) a hand-built bare stack (no opType) → never a fork
        const bare = mk([{ type: 'feed', params: { rate: 100 } }], null, {});
        const bareWrapped = wrapForkAtSave(bare);
        return { uniWrapped, alreadyWrapped, alreadyNested, editedWrapped, bareWrapped };
    });
    expect(r.uniWrapped, 'a genuine universal custom op is NOT wrapped').toBe(false);
    expect(r.alreadyWrapped, 'an already-opunit body (the Customize route) is NOT re-wrapped').toBe(false);
    expect(r.alreadyNested, 'exactly ONE opunit remains — never double-wrapped').toBe(1);
    expect(r.editedWrapped, 'an added atom makes the standard run un-identifiable → NOT wrapped (no shape-inference)').toBe(false);
    expect(r.bareWrapped, 'a hand-built bare stack (no opType) is NOT wrapped').toBe(false);
});

test.describe(() => {
    test.use({ viewport: { width: 1400, height: 1000 } });

    test('C end-to-end — a placed recognized op opened in Blocks DIRECTLY then Saved carries the opunit, emits byte-identical, and is CAM-able with surfacing LIVE', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsLoadBlockStack && window.showApp);
        await page.evaluate(() => window.showApp('blocks'));
        await page.waitForFunction(() => window.__blkws && window.ddcsSaveAsWizard, { timeout: 15000 });
        await loadPlacedDirect(page, 'user_surfacing_data');
        await saveAs(page, 'Saved Surface Fork');
        await page.screenshot({ path: `${SCRATCH}/cam-savefork-blocks.png` });   // VIEWED (ACCEPT, gated to the advisor)

        const r = await page.evaluate(async () => {
            const { listUserOps, flattenBlocks, getUserDef, defaultParams, instantiate } = await import('/blocks/userOps.js');
            const { subStackToSlot } = await import('/data/subStackToSlot.js');
            const { emitMapped } = await import('/blocks/blockEmitter.js');
            const { activeDialectOpts } = await import('/wizards/previewEmit.js');
            const all = listUserOps(); const saved = all[all.length - 1];
            const root = (saved.template || []).find((b) => b && b.type === 'user_root');
            const wrapped = !!(root && (root.children || []).length === 1 && root.children[0] && root.children[0].type === 'opunit');
            const flat = flattenBlocks(saved.template);
            const emitOf = (d) => emitMapped(instantiate(d, defaultParams(d)), activeDialectOpts()).text;
            const slot = subStackToSlot(saved);
            const bad = (saved.bindings || []).filter((b) => b.blockIndex != null && !(flat[b.blockIndex] && flat[b.blockIndex].params && (b.key in flat[b.blockIndex].params)));
            return {
                wrapped,
                opunitOpType: wrapped ? root.children[0].params.opType : null,
                opunitChildCount: wrapped ? (root.children[0].children || []).length : 0,
                flatTypes: flat.map((b) => b && b.type),
                unresolvedBindings: bad.length,
                emitIdentical: emitOf(saved) === emitOf(getUserDef('user_surfacing_data')),
                slotHasLiveLoop: /WHILE #\d+ LT #\d+ DO2/.test(slot.body || ''),
            };
        });

        expect(r.wrapped, 'the SAVE route produced the opunit sub-stack boundary').toBe(true);
        expect(r.opunitOpType, 'the opunit declares the source twin').toBe('user_surfacing_data');
        expect(r.opunitChildCount, 'the opunit wraps the exec run').toBeGreaterThan(0);
        // the uiChildren stay ahead of the opunit — the exec run moved inside it (the non-uniform shift, in the saved def)
        // t1593 — asserted as the ORDER this line has always CLAIMED, not as fixed slots. The slot form pinned a
        // param_group that came back from the canvas EMPTY: the copy inherited no bindings, so nothing refilled it and
        // `opunit` happened to land at index 4. Now the fork inherits its source's declarations, materializeParamGroup
        // repopulates the group's param_field rows, and the opunit sits after them — the same claim, one row later.
        // t2271 — surfacing's uiChildren gained a `path_anchor` node (declared picker), shifting `opunit` one row further.
        // t2301 (BACKLOG 20) — 'panel' removed from surfacing's own uiChildren (id-collided with sim's own layout2d
        // pane, see surfacingData.js's own comment); one fewer prefix row, `sim` now leads.
        // t2545 (BACKLOG #71/#72, the section migration) — surfacing's own uiChildren restructured to a SINGLE
        // `split_horizontal` node (mirroring drill) wrapping `param_group` (now non-empty: path_anchor + four
        // `group_box` folds, each holding its section's `field_ref` rows) as LEFT, `sim` as RIGHT — no more bare
        // `sim`/`path_anchor`/`param_group` siblings at the top level, so `materializeParamGroup` no longer even
        // reaches this def (field_ref-presence skip, t2543) — `param_group` here is surfacing's own DECLARED
        // structure, never materialize's target. The CLAIM itself is unchanged (everything uiChildren-side
        // precedes the opunit-wrapped exec run); checking the ONE outer `split_horizontal` node is sufficient by
        // construction — flattenBlocks is pre-order, so a parent's own index is always lower than every node
        // nested inside it, which is where param_group/usage_text/path_anchor/group_box/field_ref/sim all now
        // live. usage_text leads param_group's own children (matching drill's own usage_text-first convention,
        // and reproducing the live shell's `.wiz-usage` text verbatim — surfacingData.js's own header comment).
        expect(r.flatTypes.slice(0, 4), 'the uiChildren keep their positions').toEqual(['user_root', 'split_horizontal', 'param_group', 'usage_text']);
        expect(r.flatTypes.indexOf('opunit'), 'the opunit is present').toBeGreaterThan(-1);
        for (const ui of ['split_horizontal']) {
            expect(r.flatTypes.indexOf(ui), `${ui} (the sole top-level uiChild) precedes the opunit-wrapped exec run`).toBeLessThan(r.flatTypes.indexOf('opunit'));
        }
        expect(r.unresolvedBindings, 'EVERY saved binding still resolves to a socket that exists (no corruption)').toBe(0);
        expect(r.emitIdentical, 'the saved wrapped op emits BYTE-IDENTICAL to the source twin (opunit transparent)').toBe(true);
        expect(r.slotHasLiveLoop, 'the saved op builds a CAM slot where the surfacing part stays a LIVE loop').toBe(true);

        // …and it is CAM-able through the REAL modal: the parts table shows the surfacing sub-unit as LIVE generator knobs
        await page.evaluate(async () => {
            const { listUserOps, defaultParams, getUserDef } = await import('/blocks/userOps.js');
            const all = listUserOps(); const saved = all[all.length - 1];
            const op = { id: 'sf1', type: 'op', opType: saved.opType, label: saved.label || saved.opType, params: defaultParams(getUserDef(saved.opType) || saved) };
            window.ddcsGetBlockProgram = () => [op];
            (await import('/ui/macrosApp.js')).initMacrosApp();
            window.ddcsOpenCamAuthoring(op);
        });
        await page.waitForSelector('.cam-auth-overlay .cbm-eb');
        await page.screenshot({ path: `${SCRATCH}/cam-savefork-modal.png` });   // VIEWED (ACCEPT) — the saved placed-op fork, parts LIVE
        const modal = await page.evaluate(() => ({
            parts: [...document.querySelectorAll('#cbm_table tbody tr')].filter((tr) => tr.querySelector('td[colspan="4"]')).map((tr) => tr.textContent.trim()),
            camLabel: (document.querySelector('.cbm-op-group > div') || {}).textContent || '',
        }));
        expect(modal.camLabel, 'the saved placed-op fork routes as a sub-stack (not whole-op universal)').toMatch(/sub-stack/i);
        expect(modal.parts.join(' | '), 'the standard surfacing part is LIVE (generator loop knobs)').toMatch(/live/i);
    });

    test('C end-to-end gates — the Customize route is NOT double-wrapped; a genuine universal custom op saves unchanged', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsLoadBlockStack && window.showApp && window.ddcsEditWizardDef);

        await page.evaluate(() => window.ddcsEditWizardDef('user_surfacing_data'));   // switches to Blocks itself → mounts dev mode
        await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).some((b) => b.type === 'opunit'), { timeout: 12000 });
        await page.waitForFunction(() => !!window.ddcsSaveAsWizard, { timeout: 10000 });
        await page.waitForTimeout(300);
        await saveAs(page, 'Customize Route Fork');
        const a = await page.evaluate(async () => {
            const { listUserOps, flattenBlocks } = await import('/blocks/userOps.js');
            const all = listUserOps(); const saved = all[all.length - 1];
            const root = (saved.template || []).find((b) => b && b.type === 'user_root');
            return { topIsOpunit: !!((root.children || [])[0] || {}).type && root.children[0].type === 'opunit', childCount: (root.children || []).length, opunits: flattenBlocks(saved.template).filter((x) => x && x.type === 'opunit').length };
        });
        expect(a.topIsOpunit, 'the Customize-route save keeps its opunit').toBe(true);
        expect(a.childCount, 'exactly ONE child at the root (not re-wrapped)').toBe(1);
        expect(a.opunits, 'exactly ONE opunit in the whole template — never double-wrapped').toBe(1);

        await page.evaluate(() => window.showApp('blocks'));
        await page.evaluate(async () => {
            const OB = await import('/blocks/opBuilders.js');
            const { userOpFromStack, registerUserOp, getUserDef, defaultParams, instantiate } = await import('/blocks/userOps.js');
            registerUserOp(userOpFromStack('c_uni_save', 'Uni', [{ type: 'user_root', params: {}, children: [{ type: 'feed', params: { rate: 210 } }] }], []));
            const d = getUserDef('user_c_uni_save');
            window.ddcsLoadBlockStack([OB.makeOp('user_c_uni_save', defaultParams(d), instantiate(d, defaultParams(d)))]);
        });
        await page.waitForTimeout(400);
        await saveAs(page, 'Uni Save Fork');
        const b = await page.evaluate(async () => {
            const { listUserOps, flattenBlocks } = await import('/blocks/userOps.js');
            const all = listUserOps(); const saved = all[all.length - 1];
            return { hasOpunit: flattenBlocks(saved.template).some((x) => x && x.type === 'opunit') };
        });
        expect(b.hasOpunit, 'a genuine universal custom op saves with NO opunit (unchanged behaviour)').toBe(false);
    });

    test('rider — the Parameter Group block header reads "Parameter Group: X" (not the word "group" twice)', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsLoadBlockStack && window.showApp);
        await page.evaluate(() => window.showApp('blocks'));
        await page.waitForFunction(() => window.__blkws, { timeout: 15000 });
        await loadPlacedDirect(page, 'user_surfacing_data');
        const hdr = await page.evaluate(() => {
            const b = window.__blkws.getAllBlocks(false).find((x) => x.type === 'param_group');
            if (!b) return null;
            return b.inputList.flatMap((i) => i.fieldRow.map((f) => f.getText && f.getText())).filter(Boolean).join(' ');
        });
        expect(hdr, 'the param_group block renders a header').toBeTruthy();
        expect(hdr, 'reads "Parameter Group:" — the redundant "group" field-name prefix is gone').toMatch(/Parameter Group:/);
        expect(/Parameter Group:?\s+group\b/i.test(hdr), 'the word "group" is NOT repeated').toBe(false);
    });
});
