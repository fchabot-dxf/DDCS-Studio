import { test, expect } from '@playwright/test';
import { waitReady } from './_boot.js';

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
    await waitReady(page, () => window.ddcsStudio && window.ddcsGetBlockProgram && window.ddcsGetBlockGcode
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
    await waitReady(page, () => window.Blockly && Blockly.getMainWorkspace());
    await waitReady(page, () => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0);
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

// t1950 — LOSSLESSNESS, the assertion the advisor's own gate found missing. `regroupOps` (programModel.js) was
// corrected TWICE this turn: (1) it used to also dedupe endprogram/progend terminators via
// `collapseImportTerminators` — right for splicing (`addOperation`) but wrong here, since a plain workspace
// read-back must return every block the user placed VERBATIM, including an op's own internal terminator (corner
// carries one by original design) — the combined version tore it out and hoisted it, caught live by
// guard-roundtrip-1595. (2) `workspaceToStack` used to auto-wrap ANY 2+ bare top-level ops even when no
// `multi_step` was there to begin with, changing the top-level op COUNT for programs this feature was never
// asked to touch — caught live by marker-rebuild-1848/option-b-slice2/3/cam-multiop-edit-blocks-s45 (their own
// `.filter(op).length === N` fixture waits started timing out). Both are asserted directly here, not only
// inferred from those other files staying green.
// Split into three independent tests (each its own fresh page, the suite's own established idiom) rather than
// three cases sharing one page across multiple tab switches — avoids compounding modal/UI state across cases;
// the claim under test is the MODEL's own shape, not a UI sequencing story, so a fresh page per case is cleaner
// and more reliable than threading one page through mixed wizard-UI and direct-build steps.
const CORNER_PARAMS = { corner: 'FL', probeSeq: 'YX', travelDist: 50, safeZ: 10, scanDepth: 5, clearMode: 'hop', hopDist: 15, planeZ: 10, probeZFirst: false, travelApproach: 'auto', travelShape: 'dogleg', wcs: 'active', syncA: false, dist: 741, retract: 5, f_fast: 200, f_slow: 50, port: 3, radius: 2 };

test('LOSSLESS ROUND-TRIP, case 1: a SELF-TERMINATING op survives a workspace read-back verbatim — the terminator is not stripped or hoisted', async ({ page }) => {
    await boot(page);
    // Built directly via opBuilders.js (marker-rebuild-1848.spec.js's own established pattern), not the
    // wizard-UI insert gesture — corner's own wizard has a pre-existing prereq gate (unrelated to this turn,
    // confirmed via a throwaway debug run: openWiz('corner')+insertWiz() with only default params yields an
    // empty program) that this test has no reason to route around.
    await page.evaluate(async (params) => {
        const OB = await import('/blocks/opBuilders.js');
        window.ddcsLoadBlockStack([OB.makeOp('user_corner_data', params, OB._builderAtoms('user_corner_data', params))]);
    }, CORNER_PARAMS);
    await openBlocksTab(page);
    const r = await page.evaluate(() => {
        const prog = window.ddcsGetBlockProgram();
        return { gcode: window.ddcsGetBlockGcode(), opTypes: window.ddcsFlattenOps(prog).map((b) => b.opType) };
    });
    expect(r.opTypes, 'corner is still the one operation').toEqual(['user_corner_data']);
    expect((r.gcode.match(/M30/g) || []).length, "corner's own internal M30 survives the round-trip, not stripped").toBeGreaterThanOrEqual(1);
});

test('LOSSLESS ROUND-TRIP, case 2: two bare top-level ops with no prior wrapper are NOT auto-wrapped by a read-back with no edit', async ({ page }) => {
    await boot(page);
    // The exact shape marker-rebuild-1848/option-b-*/cam-multiop build via a direct ddcsLoadBlockStack, not
    // through addOperation.
    await page.evaluate(async () => {
        const OB = await import('/blocks/opBuilders.js');
        const drill = OB.makeOp('drill', {}, OB._builderAtoms('drill', {}));
        const surfacing = OB.makeOp('surfacing', {}, OB._builderAtoms('surfacing', {}));
        window.ddcsLoadBlockStack([drill, surfacing]);
    });
    await openBlocksTab(page);
    const r = await page.evaluate(() => window.ddcsGetBlockProgram().filter((b) => b && b.type === 'op').map((b) => b.opType));
    expect(r, 'two independently-loaded ops with no prior wrapper stay as two bare top-level ops after a read-back with no edit').toEqual(['drill', 'surfacing']);
});

test('LOSSLESS ROUND-TRIP, case 3: a program that ALREADY holds a wrapper round-trips to the identical shape when nothing is deleted', async ({ page }) => {
    await boot(page);
    await page.evaluate(async () => {
        const progMod = await import('/blocks/programModel.js');
        const OB = await import('/blocks/opBuilders.js');
        const drill = OB.makeOp('drill', {}, OB._builderAtoms('drill', {}));
        const surfacing = OB.makeOp('surfacing', {}, OB._builderAtoms('surfacing', {}));
        const pocket = OB.makeOp('pocket', {}, OB._builderAtoms('pocket', {}));
        let acc = progMod.addOperation([drill], surfacing);
        acc = progMod.addOperation(acc, pocket);
        window.ddcsLoadBlockStack(acc);
    });
    await openBlocksTab(page);
    const before = await page.evaluate(() => window.ddcsGetBlockProgram().map((b) => b.type === 'op' ? { opType: b.opType, n: (b.children || []).length } : b.type));
    // force a second read-back (Studio then back to Blocks) with no delete in between
    await page.locator('[data-app="studio"]').click();
    await page.waitForTimeout(200);
    await openBlocksTab(page);
    const after = await page.evaluate(() => window.ddcsGetBlockProgram().map((b) => b.type === 'op' ? { opType: b.opType, n: (b.children || []).length } : b.type));
    expect(after, 'an existing wrapper round-trips to the identical shape when nothing was deleted').toEqual(before);
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
