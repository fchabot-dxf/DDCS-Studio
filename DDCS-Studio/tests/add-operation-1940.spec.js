import { test, expect } from '@playwright/test';

/**
 * t1940 — THE ADD MECHANISM, DATA LEVEL ONLY. `programModel.addOperation(program, incomingBare)` is the declared
 * mechanism under the human's own Add-to-program ruling — no UI this turn; the wizard-bar Insert door
 * (wizardManager.js:512) stays untouched and wires onto this next turn. Promote-on-2nd (t1934's own Option A):
 * a bare one-op program becomes a `multi_step` wrapper holding both; a program that already holds one appends
 * into it. Reuses `groupConsecutiveOps`/`collapseImportTerminators` verbatim (now exported) — the SAME pipeline
 * `importMarkedNc` already trusts for this exact composition, not a second one built to match it.
 *
 * The assertion that matters is an EQUIVALENCE BRIDGE, not a shape check: addOperation(A,B) must emit
 * BYTE-IDENTICAL G-code to importing a file containing A then B — the import path multi-op-import-1916.spec.js
 * already proved. A test asserting only the tree shape would pass while the emitted program was wrong.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

// multi-op-import-1916.spec.js's own note, reused verbatim: progstart/progend degrade to individually-decoded
// leaf atoms on import, and a decoded leaf's own emit doesn't always carry the SAME comment text/spacing as the
// LIVE structural progstart/progend block it decoded from — pre-existing, unrelated to this task. "G-code
// equivalent" means the actual CODE a controller executes, not the human-readable comment riding beside it.
const codeOnly = (text) => text.split('\n').map((l) => l.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, '').trim()).filter(Boolean).join('\n');

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

test('addOperation(A,B) bridges to the import path — byte-identical G-code, not just a matching tree shape', async ({ page }) => {
    await boot(page);
    const programA = await insertAndCapture(page, 'drill');       // [progstart, drillOp, progend] (or similar)
    const programB = await insertAndCapture(page, 'surfacing');   // built alone so its own bare op is uncontaminated

    const r = await page.evaluate(async ({ programA, programB }) => {
        const progMod = await import('/blocks/programModel.js');
        const emitMod = await import('/blocks/blockEmitter.js');
        const dialectsMod = await import('/wizards/dialects/index.js');
        const profileMod = await import('/shared/js/profiles/controllerProfiles.js');
        const dopts = { dialect: dialectsMod.resolveActivePost(profileMod.getActiveProfile().id) };

        // The ADD path — addOperation(A, B's own bare op record). `programA` (a real single-op canvas, as
        // `ddcsGetBlockProgram()` actually returns it) carries its own progstart/progend framing.
        const bareA = programA.find((b) => b && b.type === 'op');
        const bareB = programB.find((b) => b && b.type === 'op');
        const added = progMod.addOperation(programA, bareB);
        const addedText = emitMod.emitMapped(added, dopts).text;

        // The IMPORT path, on the SAME framed footing as `programA` — multi-op-import-1916.spec.js's own reference
        // construction (ddcsLoadBlockStack([bareA, bareB]) BEFORE a single export) does NOT include progstart/
        // progend at all (that test's own 2nd op self-terminates, so it never needed the outer frame — found and
        // ruled out empirically this turn as a fair comparison for two ORDINARY, non-self-terminating operations).
        // Reusing programA's own progstart/progend keeps this an apples-to-apples bridge: BOTH sides start framed.
        const progstartA = programA.find((b) => b && b.type === 'progstart');
        const progendA = programA.find((b) => b && b.type === 'progend');
        window.ddcsLoadBlockStack([progstartA, bareA, bareB, progendA].filter(Boolean));
        const exported = window.ddcsSerializeWithMarkers();
        const imported = progMod.importMarkedNc(exported);
        const importedText = emitMod.emitMapped(imported, dopts).text;

        return {
            addedText, importedText,
            addedTopLevel: added.map((b) => ({ type: b.type, opType: b.opType })),
            addedOpTypes: progMod.flattenOps(added).map((b) => b.opType),
        };
    }, { programA, programB });

    // The two remaining differences before codeOnly() are BOTH comment-text-only (progstart/progend decoded-vs-
    // live comment wording), the same class multi-op-import-1916.spec.js's own codeOnly() already exists for —
    // confirmed by inspecting the raw diff before applying it, not assumed.
    expect(codeOnly(r.addedText), 'addOperation emits CODE byte-identical to the proven import path for the same A+B').toBe(codeOnly(r.importedText));
    // structural sanity, not the load-bearing claim above: exactly one multi_step wrapper, both steps present
    const wrapperCount = r.addedTopLevel.filter((b) => b.type === 'op' && b.opType === 'multi_step').length;
    expect(wrapperCount, 'promote-on-2nd: exactly one multi_step wrapper, not two bare siblings').toBe(1);
    expect(r.addedOpTypes, 'both operations present, in order, flattened').toEqual(['drill', 'surfacing']);
});

// t1942 — this proves the GROW direction only. The SHRINK direction (deleting a step back down to one collapses
// the wrapper, via this SAME groupConsecutiveOps, not a hand-rolled mirror rule) is t1934's own stated design —
// it is NOT built or called anywhere yet. Do not read this test as covering that path; it doesn't exist to cover.
test('the symmetric rule: a run of ONE stays unwrapped — the same function that wraps a run of 2 also refuses to wrap 1', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const progMod = await import('/blocks/programModel.js');
        const lone = progMod.groupConsecutiveOps([{ type: 'op', id: 'x1', opType: 'drill', label: 'Drill', params: {}, children: [] }]);
        return lone.map((b) => b.type === 'op' ? b.opType : b.type);
    });
    expect(r, 'a single operation is never wrapped in a multi_step of its own').toEqual(['drill']);
});

test('ASSERT WHAT THE USER GETS: after adding a 2nd operation, the setup sheet lists 2 (with their own tools), the time estimate splits 2 ways and sums to the total, and both bodies are in the G-code', async ({ page }) => {
    await boot(page);
    const programA = await insertAndCapture(page, 'drill');
    const programB = await insertAndCapture(page, 'surfacing');

    const r = await page.evaluate(async ({ programA, programB }) => {
        const progMod = await import('/blocks/programModel.js');
        const bareB = programB.find((b) => b && b.type === 'op');
        const added = progMod.addOperation(programA, bareB);
        const ops = progMod.flattenOps(added);
        ops[0].params.toolNum = 1;
        ops[1].params.toolNum = 2;
        window.ddcsLoadBlockStack(added);
        await new Promise((res) => setTimeout(res, 400));

        const { estimateProgram, secondsForLines } = await import('/engine/timeEstimate.js');
        const nc = window.ddcsGetBlockGcode();
        const est = estimateProgram(nc, { rapidRate: 6000 });
        const liveOps = progMod.flattenOps(window.ddcsGetBlockProgram() || []);
        const per = liveOps.map((op) => secondsForLines(est.perLine, window.ddcsLinesForOp(op.id) || []));
        const sum = per.reduce((a, b) => a + b, 0);

        return {
            nOps: liveOps.length,
            toolNums: liveOps.map((op) => op.params.toolNum),
            perPositive: per.every((s) => s > 0),
            sum, moveSec: est.moveSec,
            hasDrillBody: nc.includes('DRILL'),
            hasSurfacingBody: nc.includes('SURFACING'),
        };
    }, { programA, programB });

    expect(r.nOps, 'the flattened program holds 2 operations').toBe(2);
    expect(r.toolNums, 'each operation carries its own declared tool').toEqual([1, 2]);
    expect(r.perPositive, 'each operation has a positive time estimate (per-op split resolves, not a skipped body)').toBe(true);
    expect(r.sum, 'the per-op split never exceeds the total move time').toBeLessThanOrEqual(r.moveSec + 1e-6);
    expect(r.sum / r.moveSec, 'the per-op times account for ~all the move time').toBeGreaterThan(0.99);
    expect(r.hasDrillBody, 'the drill body is present in the emitted G-code').toBe(true);
    expect(r.hasSurfacingBody, 'the surfacing body is present in the emitted G-code too — not dropped').toBe(true);
});

// t1942 — FIXED: the prior version of this test reloaded the SAME program and never called addOperation or any
// of its own machinery at all — it would have passed unchanged even if addOperation corrupted every
// single-operation program in the app, which is the exact claim its own name made. A test that cannot fail is
// worse than no test: it stops the next reader looking. This version runs `groupConsecutiveOps` +
// `collapseImportTerminators` — the EXACT shared pipeline addOperation is composed from — directly against the
// program, with nothing added, and asserts that pipeline is a true IDENTITY on the overwhelmingly common
// single-operation case: no wrapper introduced, byte-identical emit. A bug that wrapped even a run of ONE
// (e.g. `run.length >= 1` instead of `> 1`) would fail this.
test('STOP-CONDITION CHECK: the shared pipeline addOperation is built from is an IDENTITY on a one-operation program', async ({ page }) => {
    await boot(page);
    const programA = await insertAndCapture(page, 'drill');
    const gcodeBefore = await page.evaluate(() => window.ddcsGetBlockGcode());

    const r = await page.evaluate(async (programA) => {
        const progMod = await import('/blocks/programModel.js');
        const emitMod = await import('/blocks/blockEmitter.js');
        const dialectsMod = await import('/wizards/dialects/index.js');
        const profileMod = await import('/shared/js/profiles/controllerProfiles.js');
        const dopts = { dialect: dialectsMod.resolveActivePost(profileMod.getActiveProfile().id) };
        const rebuilt = progMod.collapseImportTerminators(progMod.groupConsecutiveOps(programA));
        return {
            rebuiltShape: rebuilt.map((b) => (b.type === 'op' ? b.opType : b.type)),
            rebuiltText: emitMod.emitMapped(rebuilt, dopts).text,
        };
    }, programA);

    expect(r.rebuiltShape.includes('multi_step'), 'a lone operation is never wrapped by the pipeline addOperation shares').toBe(false);
    expect(r.rebuiltText, 'the shared pipeline, run with nothing added, is byte-identical').toBe(gcodeBefore);
});
