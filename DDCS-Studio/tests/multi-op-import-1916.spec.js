import { test, expect } from '@playwright/test';
import { openWizardViaBar, clickInsert } from './support/barGesture.js';

// t1920 — FIXTURE CHANGED, claim unchanged. A real bar-gesture Insert now REPLACES the program (t1916/t1918/
// t1920's own ruling: a Studio-canvas program is always exactly one op) — two live inserts can no longer produce
// a real multi-op program to export at all. Built directly instead, via the SAME production functions the
// (deleted) accumulation path used to call (`opBuilders.js`'s own `makeOp`/`_builderAtoms`), matching
// `prog-marker-slot-812.spec.js`'s own established hand-built-fixture pattern. Params captured from a real
// live insert of each op (drill's own shipped defaults; corner's own shipped defaults with `dist:741`) — not
// invented, so the fixture still exercises a representative shape, not an edge case.
const DRILL_PARAMS = { offZ: 0, x0: 0, y0: 0, cols: 3, rows: 2, dx: 20, dy: 20, count: 4, spacing: 20, angle: 0, dia: 50, startAngle: 0, w: 100, h: 80, nx: 2, ny: 2, toolNum: '', wcs: 'active', stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 100, stockH: 80, stockZ: 20, originX: 0, originY: 0, pattern: 'single', skip: '', depth: 5, peck: 5, feed: 100 };
const CORNER_PARAMS = { corner: 'FL', probeSeq: 'YX', travelDist: 50, safeZ: 10, scanDepth: 5, clearMode: 'hop', hopDist: 15, planeZ: 10, probeZFirst: false, travelApproach: 'auto', travelShape: 'dogleg', wcs: 'active', syncA: false, dist: 741, retract: 5, f_fast: 200, f_slow: 50, port: 3, radius: 2 };

// Progstart/progend degrade to individual leaf atoms on import (pre-existing, unrelated to this task — a leaf
// atom's own emit doesn't always carry the SAME comment text/spacing as the structural progstart/progend block
// it decoded from). "G-code equivalent" here means the actual CODE — the part a controller executes — not the
// human-readable comment riding beside it. Strips a trailing `( … )` comment and collapses whitespace per line.
const codeOnly = (text) => text.split('\n').map((l) => l.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, '').trim()).filter(Boolean).join('\n');

/**
 * t1916 — STEP 1 of the one-op sequence. The user ruled the import question t1914 flagged: a multi-op .nc
 * (today's own accumulation-export shape) imports as ONE op carrying N steps — nothing discarded, no refusal.
 *
 * Proves losslessness FIRST, as the dispatch required, on a REAL multi-op program (Drill then Corner, mirroring
 * t1828's own proven real-gesture pattern — not hand-built params, which risks testing an unrepresentative shape):
 * every op present as a step, its own params intact, and the re-emitted G-code equivalent to the original.
 *
 * Along the way, found and fixed a PRE-EXISTING bug this proof would otherwise have failed on for an unrelated
 * reason: `importMarkedNc`'s "skip until the next marker" discarded whatever text followed the LAST marker in the
 * file — progend's own M5/M9/retract/M30, which never carries a marker of its own. This affected even a
 * single-op import, not just multi-op; fixed by skipping the op's own TRUE re-emitted line count instead.
 */

test('a real multi-op .nc imports as ONE op carrying N steps — every op present, params intact, G-code equivalent', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    await page.evaluate(async ({ drillParams, cornerParams }) => {
        const OB = await import('/blocks/opBuilders.js');
        const drillOp = OB.makeOp('user_drill_data', drillParams, OB._builderAtoms('user_drill_data', drillParams));
        const cornerOp = OB.makeOp('user_corner_data', cornerParams, OB._builderAtoms('user_corner_data', cornerParams));
        window.ddcsLoadBlockStack([drillOp, cornerOp]);
    }, { drillParams: DRILL_PARAMS, cornerParams: CORNER_PARAMS });
    await page.waitForFunction(() => window.ddcsGetBlockProgram().filter((b) => b.type === 'op').length === 2, null, { timeout: 10000 });

    const r = await page.evaluate(async () => {
        const progMod = await import('/blocks/programModel.js');

        const origStack = window.ddcsGetBlockProgram();
        const origOps = origStack.filter((b) => b && b.type === 'op');
        const origText = window.ddcsGetProjection().text;
        const exported = window.ddcsSerializeWithMarkers();

        const imported = progMod.importMarkedNc(exported);

        // re-emit the imported stack the same way the live editor projects it
        const emitMod = await import('/blocks/blockEmitter.js');
        const dialectsMod = await import('/wizards/dialects/index.js');
        const profileMod = await import('/shared/js/profiles/controllerProfiles.js');
        const dopts = { dialect: dialectsMod.resolveActivePost(profileMod.getActiveProfile().id) };
        const reEmitted = emitMod.emitMapped(imported, dopts).text;

        return {
            importedTopLevel: imported.map((b) => ({ type: b && b.type, opType: b && b.opType })),
            origOpTypes: origOps.map((b) => b.opType),
            origParamsByType: Object.fromEntries(origOps.map((b) => [b.opType, b.params])),
            origText, reEmitted,
        };
    });

    // ── STRUCTURE: exactly one top-level op, opType multi_step, wrapping the 2 originals as steps ──
    const ops = r.importedTopLevel.filter((b) => b.type === 'op');
    expect(ops.length, 'exactly one top-level op after import').toBe(1);
    expect(ops[0].opType, 'the wrapper is the new multi_step type').toBe('multi_step');

    const importedStepTypes = await page.evaluate(async () => {
        const progMod = await import('/blocks/programModel.js');
        const exported = window.ddcsSerializeWithMarkers();
        const imported = progMod.importMarkedNc(exported);
        const wrapper = imported.find((b) => b && b.type === 'op' && b.opType === 'multi_step');
        return (wrapper.children || []).map((c) => ({ opType: c.opType, params: c.params }));
    });
    expect(importedStepTypes.map((s) => s.opType), 'every original op present, in order, as a step').toEqual(r.origOpTypes);
    for (const step of importedStepTypes) {
        expect(step.params, `step ${step.opType}'s own params are intact`).toEqual(r.origParamsByType[step.opType]);
    }

    // ── G-CODE: the re-emitted program is equivalent to the original (exactly one M30, both ops' own content present) ──
    const countM30 = (s) => (s.match(/\bM30\b/g) || []).length;
    expect(countM30(r.reEmitted), 'the re-emitted program carries exactly one M30 — no accumulation ghosts').toBe(1);
    expect(r.reEmitted, 'drill\'s own signature line survives').toContain('DRILL, parametric');
    // the re-emitted CODE is line-for-line equal to the original projection's own code (comments aside — see
    // codeOnly's own note) — the literal "nothing lost" check, not a proxy for it.
    expect(codeOnly(r.reEmitted)).toBe(codeOnly(r.origText));
});

test('a SINGLE marked op still imports as itself — no multi_step wrapper introduced where none is needed', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Mill' }).click();
    await page.locator('.dock-header .toolbar-dropdown-content button[data-optype="drill"]', { hasText: 'Drill' }).click();
    await clickInsert(page);
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });

    const r = await page.evaluate(async () => {
        const progMod = await import('/blocks/programModel.js');
        const origText = window.ddcsGetProjection().text;
        const exported = window.ddcsSerializeWithMarkers();
        const imported = progMod.importMarkedNc(exported);

        const emitMod = await import('/blocks/blockEmitter.js');
        const dialectsMod = await import('/wizards/dialects/index.js');
        const profileMod = await import('/shared/js/profiles/controllerProfiles.js');
        const dopts = { dialect: dialectsMod.resolveActivePost(profileMod.getActiveProfile().id) };
        const reEmitted = emitMod.emitMapped(imported, dopts).text;

        return {
            importedOpTypes: imported.filter((b) => b && b.type === 'op').map((b) => b.opType),
            origText, reEmitted,
        };
    });

    expect(r.importedOpTypes, 'no multi_step wrapper for a lone op — byte-identical shape to today').toEqual(['user_drill_data']);
    expect(codeOnly(r.reEmitted)).toBe(codeOnly(r.origText));
});

test('a STANDALONE probe op (its own internal M30 IS the true terminator, no progend framing precedes it) keeps its own M30 on import', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    // Corner ALONE (no drill/cutting op first) — the case where appendIntoProgram's "first op: keep as-is" path
    // never calls normalizeEnds, so corner's own internal `endprogram` genuinely IS the program's real terminator
    // (not a redundant one to strip). Exercises the opposite branch from the drill+corner test above: the
    // per-op strip-before-measure in importMarkedNc must not silently lose the only M30 the file has.
    await openWizardViaBar(page, { group: 'Probe', optype: 'corner' });
    await expect(page.locator('#wiz_user_form [data-param="dist"]')).toBeVisible({ timeout: 5000 });
    await clickInsert(page);
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });

    const r = await page.evaluate(async () => {
        const progMod = await import('/blocks/programModel.js');
        const origText = window.ddcsGetProjection().text;
        const exported = window.ddcsSerializeWithMarkers();
        const imported = progMod.importMarkedNc(exported);

        const emitMod = await import('/blocks/blockEmitter.js');
        const dialectsMod = await import('/wizards/dialects/index.js');
        const profileMod = await import('/shared/js/profiles/controllerProfiles.js');
        const dopts = { dialect: dialectsMod.resolveActivePost(profileMod.getActiveProfile().id) };
        const reEmitted = emitMod.emitMapped(imported, dopts).text;

        return { origText, reEmitted };
    });

    const countM30 = (s) => (s.match(/\bM30\b/g) || []).length;
    expect(countM30(r.origText), 'sanity: the original standalone-corner program has exactly one M30').toBe(1);
    expect(countM30(r.reEmitted), 'the re-imported program keeps exactly one M30 — not lost, not duplicated').toBe(1);
    expect(codeOnly(r.reEmitted)).toBe(codeOnly(r.origText));
});
