import { test, expect } from '@playwright/test';

/**
 * t1948 — COLLAPSE-ON-DELETE, wired at the single choke point t1946 confirmed: `workspaceToStack`
 * (stackBridge.js:173). Every structural Blockly edit re-reads the workspace through that one function, so it's
 * where a `multi_step` wrapper left holding fewer children after a native block-delete needs to reconcile.
 * `regroupOps` (programModel.js, t1948) is the SAME flatten-then-regroup pipeline `addOperation` grows a program
 * with, wired in at both ends — grow and shrink share one rule.
 *
 * The load-bearing claim: deleting a block genuinely IN THE BLOCKS TAB (Blockly's own `checkAndDelete()` — the
 * same call the UI's own Delete-key/right-click-delete path uses, not a data-level splice) drives the model back
 * down to the shape `addOperation` would have produced for the same remaining content — never a stale/nested
 * wrapper, and never wrong G-code (a multi_step wrapper carries no G-code of its own, so collapsing it can only
 * change which ops share a wrapper).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function boot(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram && window.ddcsGetBlockGcode
        && window.openWiz && window.updateWiz && window.insertWiz);
}

async function insertAndCapture(page, opType) {
    await page.evaluate(async (t) => {
        window.ddcsLoadBlockStack([]);
        window.openWiz(t, undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
    }, opType);
    return page.evaluate(() => window.ddcsGetBlockProgram());
}

/** Fold N single-op captures through the real addOperation pipeline — exactly the live Insert->Add->Add gesture. */
async function foldOps(page, programs) {
    return page.evaluate(async (programs) => {
        const progMod = await import('/blocks/programModel.js');
        let acc = programs[0];
        for (let i = 1; i < programs.length; i++) {
            const bare = programs[i].find((b) => b && b.type === 'op');
            acc = progMod.addOperation(acc, bare);
        }
        return acc;
    }, programs);
}

async function openBlocksTab(page) {
    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => window.Blockly && Blockly.getMainWorkspace(), null, { timeout: 20000 });
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });
    await page.waitForTimeout(500);   // let the initial stackToWorkspace render settle before we start deleting
}

/** Delete the top-level 'op' block whose data.opType matches `opType`, via Blockly's own real delete call
 *  (checkAndDelete — the same one the UI's Delete key / right-click Delete use), then wait for the model to
 *  reflect the change (reproject runs SYNC inside the change listener, but Blockly's own event dispatch is
 *  queued — poll rather than assume same-tick). */
async function deleteOpByType(page, opType) {
    await page.evaluate((opType) => {
        const ws = Blockly.getMainWorkspace();
        const target = ws.getAllBlocks(false).find((b) => {
            if (b.type !== 'op' && !b.type.endsWith('_op')) return false;
            try { return JSON.parse(b.data || '{}').opType === opType; } catch (_) { return false; }
        });
        if (!target) throw new Error(`deleteOpByType: no op block found for opType "${opType}"`);
        target.checkAndDelete();
    }, opType);
    await page.waitForFunction((removedType) => {
        const prog = window.ddcsGetBlockProgram() || [];
        return (window.ddcsFlattenOps(prog) || []).every((b) => b.opType !== removedType);
    }, opType, { timeout: 10000 });
}

test('deleting one step from a 3-op multi_step collapses to a FLAT 2-op wrapper — not nested, not stale', async ({ page }) => {
    await boot(page);
    const A = await insertAndCapture(page, 'drill');
    const B = await insertAndCapture(page, 'surfacing');
    const C = await insertAndCapture(page, 'pocket');
    const before = await foldOps(page, [A, B, C]);   // [progstart, multi_step(drill,surfacing,pocket), progend]

    await page.evaluate((before) => window.ddcsLoadBlockStack(before), before);
    await openBlocksTab(page);
    await deleteOpByType(page, 'surfacing');

    const r = await page.evaluate(() => {
        const prog = window.ddcsGetBlockProgram();
        const wrappers = prog.filter((b) => b && b.type === 'op' && b.opType === 'multi_step');
        const anyNestedChild = wrappers.some((w) => (w.children || []).some((c) => c && c.opType === 'multi_step'));
        return {
            wrapperCount: wrappers.length,
            anyNestedChild,
            opTypes: window.ddcsFlattenOps(prog).map((b) => b.opType),
            gcode: window.ddcsGetBlockGcode(),
        };
    });

    expect(r.wrapperCount, 'exactly one multi_step wrapper remains').toBe(1);
    expect(r.anyNestedChild, 'the collapse never nests — same flatten-then-regroup pipeline as addOperation').toBe(false);
    expect(r.opTypes, 'drill and pocket survive, surfacing is gone, order preserved').toEqual(['drill', 'pocket']);
    // Content markers, checked against the wizards' own real output (verified live, not assumed — pocket's own
    // comments never literally say "POCKET", unlike drill/surfacing's own bodies).
    expect(r.gcode.includes('DRILL'), 'drill body still emits').toBe(true);
    expect(r.gcode.includes('AREA CLEARING'), "pocket's own body still emits").toBe(true);
    expect(r.gcode.includes('SURFACING'), 'surfacing body is genuinely gone from the emitted program').toBe(false);
});

test('deleting the 2nd of TWO steps collapses the wrapper away entirely — a lone op is never left wrapped', async ({ page }) => {
    await boot(page);
    const A = await insertAndCapture(page, 'drill');
    const B = await insertAndCapture(page, 'surfacing');
    const before = await foldOps(page, [A, B]);   // [progstart, multi_step(drill,surfacing), progend]

    await page.evaluate((before) => window.ddcsLoadBlockStack(before), before);
    await openBlocksTab(page);
    await deleteOpByType(page, 'surfacing');

    const r = await page.evaluate(() => {
        const prog = window.ddcsGetBlockProgram();
        return {
            hasWrapper: prog.some((b) => b && b.type === 'op' && b.opType === 'multi_step'),
            opTypes: window.ddcsFlattenOps(prog).map((b) => b.opType),
        };
    });

    expect(r.hasWrapper, 'a program holding one real operation is never left inside a multi_step wrapper').toBe(false);
    expect(r.opTypes).toEqual(['drill']);
});

test('CONVERGENCE: add 3 then delete 1 is shape- and emit-identical to having added only 2 (the symmetric-rule promise, t1934/t1946)', async ({ page }) => {
    await boot(page);
    const A = await insertAndCapture(page, 'drill');
    const B = await insertAndCapture(page, 'surfacing');
    const C = await insertAndCapture(page, 'pocket');

    // Side 1: grow to 3, then shrink back down by deleting the 3rd (pocket) in the Blocks tab.
    const grown = await foldOps(page, [A, B, C]);
    await page.evaluate((grown) => window.ddcsLoadBlockStack(grown), grown);
    await openBlocksTab(page);
    await deleteOpByType(page, 'pocket');
    const afterShrink = await page.evaluate(() => ({
        program: window.ddcsGetBlockProgram(),
        gcode: window.ddcsGetBlockGcode(),
    }));

    // Side 2: the direct 2-op grow path, addOperation(A, B) — never touched a 3rd op or a delete.
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    const directAdded = await foldOps(page, [A, B]);
    await page.evaluate((directAdded) => window.ddcsLoadBlockStack(directAdded), directAdded);
    await page.waitForTimeout(300);
    const direct = await page.evaluate(() => ({
        program: window.ddcsGetBlockProgram(),
        gcode: window.ddcsGetBlockGcode(),
    }));

    const shapeOf = (prog) => prog.map((b) => (b.type === 'op' ? { opType: b.opType, nChildren: (b.children || []).length } : b.type));
    const codeOnly = (text) => text.split('\n').map((l) => l.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, '').trim()).filter(Boolean).join('\n');

    expect(shapeOf(afterShrink.program), 'add-3-then-delete-1 produces the SAME shape as a direct add-2').toEqual(shapeOf(direct.program));
    expect(codeOnly(afterShrink.gcode), 'add-3-then-delete-1 emits the SAME G-code as a direct add-2').toBe(codeOnly(direct.gcode));
});
