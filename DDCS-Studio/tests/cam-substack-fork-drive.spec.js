import { test, expect } from '@playwright/test';

const SCRATCH = 'scratchpad';

// Sub-stack S3 — the FORK PATH declares opunit. At fork/LOAD time (editWizardDef), a RECOGNIZED generator twin (surfacing/
// corner/…) opened to customize has its exec atoms WRAPPED in an opunit(opType, defV) so subStackToSlot keeps the standard
// part LIVE. A genuine custom op is NOT wrapped. opunit is emit-transparent → the forked op's own emit is byte-identical.
//
// Split from cam-substack-fork.spec.js at the tier migration work package 4; its two sibling tests (the pure
// wrap/emit/subStackToSlot checks) moved to tests/node/cam-substack-fork.test.mjs. This one stayed: it round-trips the
// opunit through the real Blockly workspace (window.showApp/ddcsLoadBlockStack/window.__blkws), reads block fields off
// live block instances, and takes a screenshot — genuine app+DOM dependencies.

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
            const { childrenOf } = await import('/blocks/userOps.js');
            const back = workspaceToStack(window.__blkws);
            let opunit = null;
            // t2339 — childrenOf, not a bare (bs||[]): a split_horizontal/split_vertical node's `.children` is
            // mouth-keyed, not a plain array (t2337's roundtrip-1319 finding).
            const walk = (bs) => { for (const b of childrenOf(bs)) { if (!b) continue; if (b.type === 'opunit') opunit = b; walk(b.uiChildren); walk(b.children); } };
            walk(back);
            // t1071 — the chip: a friendly per-instance label + the routing key rendered READ-ONLY (audit Finding 1)
            const blk = window.__blkws.getAllBlocks(false).find((b) => b.type === 'opunit');
            const lf = blk && blk.getField('OPUNIT_LABEL'), otf = blk && blk.getField('OPTYPE');
            return { hasOpunit: !!opunit, opunitOpType: opunit && opunit.params && opunit.params.opType, opunitChildCount: opunit ? (opunit.children || []).length : 0,
                chipLabel: lf ? lf.getText() : null, opTypeEditable: otf ? !!otf.EDITABLE : null };   // setEditable(false) sets field.EDITABLE=false (this Blockly has no isEditable())
        });
        await page.screenshot({ path: `${SCRATCH}/s3-opunit-chip.png` });   // VIEW how the opunit chip renders
        // the DO-mouth fix (bridge.js + stackBridge.js) — the opunit keeps its exec children through the workspace round-trip
        expect(r.hasOpunit, 'the opunit survives the workspace round-trip').toBe(true);
        expect(r.opunitOpType).toBe('user_surfacing_data');
        expect(r.opunitChildCount, 'the opunit keeps its 6 exec children through the round-trip (NOT dropped)').toBe(6);
        // t1071 chip label (audit Finding 1): a friendly per-instance label + the routing key non-editable (round-trip STILL preserves opType above = the regression guard)
        expect(r.chipLabel, 'the chip renders a friendly per-instance label ending in "unit" (not the raw opType)').toMatch(/unit$/i);
        expect(r.opTypeEditable, 'the opType routing key is READ-ONLY (an editable key is a corruptible foot-gun)').toBe(false);
    });
});
