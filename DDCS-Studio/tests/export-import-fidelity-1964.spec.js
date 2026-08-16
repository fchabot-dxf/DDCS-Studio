import { test, expect } from '@playwright/test';

/**
 * t1964 — RELEASE BLOCKER: t1958's `findOpInStack` reorder (deepest-match-wins, for the Edit chip's own by-line
 * resolution) silently broke `.nc` EXPORT for any program containing `user_homing_data`. Caught by the advisor's
 * own release gate on `blk-start-hints-multistep-1954` — a test that was GREEN when written, because that test
 * never visited the Blocks tab before exporting; visiting it is what triggers the regression.
 *
 * ROOT CAUSE, traced not guessed: `user_homing_data`'s own builder (`homingWizard.js`'s `homingDataStack`) nests
 * an internal `{type:'op', opType:'homing'}` fragment inside its own `user_root` authoring body — deliberately
 * never given an id by this codebase (t1842/t1838's own finding: "LOAD-BEARING and left alone"), specifically so
 * `findOpInStack` could never independently address it. `corner`'s own `user_root` has no such fragment (its own
 * children are plain `section`s) — this shape is homing-specific, not universal. A Blockly workspace round-trip
 * (visiting the Blocks tab) assigns a REAL id to every block it renders, including this one — so t1958's own
 * "deepest match, guarded by `id != null`" rule started matching the fragment instead of the real
 * `user_homing_data` record: the export marker for a Homing-then-Corner program read `{"op":"homing"}` with NO
 * PARAMS, and `importMarkedNc` reconstructed 2 loose top-level ops instead of one `multi_step` wrapper.
 *
 * FIXED at `programModel.js`'s `findOpInStack`: `user_root` is now an opacity BOUNDARY for this search — nothing
 * inside one op's own authoring body can ever be a DIFFERENT, independently-addressable op, so the recursion
 * never descends into it hunting for a nested `type:'op'` match, regardless of whether that fragment has gained
 * an id. This is more robust than the original id-null guard (t1842), which depended on an invariant a Blockly
 * round-trip could silently break.
 *
 * This file asserts the user-facing stake directly, bridging to `multi-op-import-1916`'s own byte-identical
 * standard: an exported `.nc` — after the program has been through the Blocks tab, the realistic path that
 * triggers the regression — must re-import to the SAME program, byte-identical G-code, not just a matching
 * top-level shape.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

// Same normalization as multi-op-import-1916.spec.js — "G-code equivalent" means the actual controller-executed
// code, not the human-readable comment riding beside it.
const codeOnly = (text) => text.split('\n').map((l) => l.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, '').trim()).filter(Boolean).join('\n');

async function clickNow(page, selector) {
    await page.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.click(); }, selector);
}

test('a Homing+Corner program, after a Blocks-tab visit, exports and re-imports BYTE-IDENTICAL — not just the same top-level shape', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    // Built via the REAL "Add" gesture (the wizard bar, shipped defaults) — not two independently-built ops
    // concatenated by hand. Homing is a SELF-TERMINATING op (its own body carries an internal M30), and only
    // `addOperation`'s own `collapseImportTerminators` step (t1940/t1946) knows to fold that away when a second
    // op follows it; a hand-spliced fixture would carry a stray mid-program M30 that was never expected to
    // round-trip (a separate, pre-existing, documented gap in `addOperation`'s own comment — not this
    // regression). This is also simply the realistic path: a user builds a multi-op program through Add.
    await page.evaluate(() => { window.openWiz('user_homing_data', undefined, true); window.updateWiz(); });
    await page.evaluate(() => window.insertWiz());
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).some((b) => b && b.opType === 'user_homing_data'), { timeout: 8000 });
    await page.evaluate(() => { window.openWiz('user_corner_data', undefined, true); window.updateWiz(); });
    await page.evaluate(() => { window.insertWiz(); });   // fires the confirm dialog (canvas non-empty)
    await page.waitForSelector('.app-dialog', { timeout: 8000 });
    await page.click('.app-dialog button:has-text("Add as a 2nd operation")');
    await page.waitForFunction(() => !document.querySelector('.app-dialog'));
    await page.waitForFunction(async () => {
        const progMod = await import('/blocks/programModel.js');
        return progMod.flattenOps(window.ddcsGetBlockProgram() || []).length === 2;
    }, { timeout: 10000 });

    // Capture the ORIGINAL params right after building, before anything else touches the stack — the round-trip
    // must reproduce these EXACTLY, whatever the wizard's own shipped defaults happen to be (not a hardcoded
    // literal that could itself drift from them).
    const originals = await page.evaluate(async () => {
        const progMod = await import('/blocks/programModel.js');
        const ops = progMod.flattenOps(window.ddcsGetBlockProgram() || []);
        return {
            homingParams: (ops.find((b) => b.opType === 'user_homing_data') || {}).params,
            cornerParams: (ops.find((b) => b.opType === 'user_corner_data') || {}).params,
        };
    });

    // THE TRIGGER — visiting the Blocks tab runs the program through Blockly, which assigns a real id to every
    // block it renders (including homing's own internal, deliberately id-less fragment). Without this step the
    // regression never manifests, which is exactly why blk-start-hints-multistep-1954 was green when it landed.
    await clickNow(page, '[data-app="blocks"]');
    await page.waitForFunction(() => window.__blkws, null, { timeout: 10000 });
    await page.waitForTimeout(1500);

    const r = await page.evaluate(async () => {
        const origText = window.ddcsGetBlockGcode();
        const exported = window.ddcsSerializeWithMarkers();
        const progMod = await import('/blocks/programModel.js');
        const imported = progMod.importMarkedNc(exported);

        const emitMod = await import('/blocks/blockEmitter.js');
        const dialectsMod = await import('/wizards/dialects/index.js');
        const profileMod = await import('/shared/js/profiles/controllerProfiles.js');
        const dopts = { dialect: dialectsMod.resolveActivePost(profileMod.getActiveProfile().id) };
        const reEmitted = emitMod.emitMapped(imported, dopts).text;

        const wrapper = imported.find((b) => b && b.type === 'op' && b.opType === 'multi_step');
        const steps = (wrapper && wrapper.children) || [];
        return {
            exportedMarkers: exported.split('\n').filter((l) => l.includes('@DDCS:1')),
            topLevelOpCount: imported.filter((b) => b && b.type === 'op').length,
            wrapperOpType: wrapper && wrapper.opType,
            stepTypes: steps.map((s) => s.opType),
            homingParams: (steps.find((s) => s.opType === 'user_homing_data') || {}).params,
            cornerParams: (steps.find((s) => s.opType === 'user_corner_data') || {}).params,
            origText, reEmitted,
        };
    });

    // THE MARKERS THEMSELVES — each carries the REAL op's own opType, not the internal fragment.
    expect(r.exportedMarkers.length, 'exactly one marker per real op, not one per internal fragment').toBe(2);
    expect(r.exportedMarkers[0], 'the first marker names the REAL homing op, not its internal "homing" fragment').toContain('"op":"user_homing_data"');

    // THE STRUCTURE — matches multi-op-import-1916's own established shape claim.
    expect(r.topLevelOpCount, 'exactly one top-level op after import').toBe(1);
    expect(r.wrapperOpType, 'the wrapper is the multi_step type').toBe('multi_step');
    expect(r.stepTypes, 'both real ops present, in order, as steps').toEqual(['user_homing_data', 'user_corner_data']);

    // THE PARAMS — round-tripped intact, not silently emptied (the exact way the regression corrupted them).
    expect(r.homingParams, 'homing\'s own params survived the round-trip byte-for-byte').toEqual(originals.homingParams);
    expect(r.cornerParams, 'corner\'s own params survived the round-trip byte-for-byte').toEqual(originals.cornerParams);

    // THE USER-FACING STAKE — bridging to multi-op-import-1916's own standard: the re-emitted CODE is
    // line-for-line equal to the original, not merely "looks like a wrapper."
    expect(codeOnly(r.reEmitted), 'the re-imported program emits BYTE-IDENTICAL G-code to the original').toBe(codeOnly(r.origText));
});
