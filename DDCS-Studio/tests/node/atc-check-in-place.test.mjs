import { test, expect } from './support/harness.mjs';

/**
 * ATC TOOL CHECK — the last quick win (t411), INHERITS the Tool Length light-ATC recipe exactly. A NEW twin
 * (user_atc_check_data) via userOpFromStack + 8 scalar bindingSpecs by #var identity (+tolerance #20), the two source-touches
 * (header recompose + source-chips), wired IN-PLACE. VERIFY: emit BYTE-IDENTICAL to atcToolCheckStack across a scalar sweep
 * on BOTH profiles (studio AND Expert, source-resolver stubbed) · cross-dialect · in-place + plain title.
 *
 * TIER MIGRATION WORK PACKAGE D: moved browser→node. Three of the four tests moved — plain import()+evaluate over
 * declared builders/emitters/registries, no DOM. The file's 4th test ("DRIVE: ... a NON-EMPTY form ... + the 3D
 * machine sim renders") opens the twin via window.openWiz, reads real DOM, and screenshots the panel — a genuine
 * app+DOM dependency, not a candidate for this tier. Split into tests/atc-check-in-place-drive.spec.js. Both moved
 * emit-comparison tests explicitly `registerUserOp(atcCheckDataDef())` the twin, since the node tier never runs
 * web/app.js's seedDefaultPortedUserOps() that seeds it in the browser.
 */
const OPTYPE = 'user_atc_check_data';

test('emit BYTE-IDENTICAL to atcToolCheckStack across a scalar sweep — studio AND Expert (source-resolver stubbed ON)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (OPTYPE) => {
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { atcToolCheckStack } = await import('/wizards/atcToolCheckWizard.js');
        const { ATC_CHECK_DEFAULTS, atcCheckDataDef } = await import('/blocks/dataOps/atcCheckData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        registerUserOp(atcCheckDataDef());   // the node tier never runs web/app.js's seedDefaultPortedUserOps()
        const sweep = [
            ATC_CHECK_DEFAULTS,
            { ...ATC_CHECK_DEFAULTS, tolerance: 0.1, blockHeight: 60, safeZ: 15 },
            { ...ATC_CHECK_DEFAULTS, maxDist: 120, retract: 5, f_fast: 400, f_slow: 40 },
            { ...ATC_CHECK_DEFAULTS, port: 3, blockHeight: 25.4, tolerance: 0.25 },
        ];
        const orig = window.ddcsResolveProbeSources;
        let studioDiffs = 0, expertDiffs = 0, firstDiff = null;
        window.ddcsResolveProbeSources = () => ({});
        for (const p of sweep) {
            const twin = emitMapped(builderOf(OPTYPE)(p)).text;
            const builtin = emitMapped(atcToolCheckStack(p)).text;
            if (twin !== builtin) { studioDiffs++; if (!firstDiff) firstDiff = { profile: 'studio', p, twin: twin.slice(0, 1000), builtin: builtin.slice(0, 1000) }; }
        }
        const REG = { setterPort: '#1078', blockHeight: '#1170' };
        window.ddcsResolveProbeSources = () => ({ ...REG });
        for (const p of sweep) {
            const twin = emitMapped(builderOf(OPTYPE)(p)).text;
            const builtin = emitMapped(atcToolCheckStack({ ...p, sources: { ...REG } })).text;
            if (twin !== builtin) { expertDiffs++; if (!firstDiff) firstDiff = { profile: 'expert', p, twin: twin.slice(0, 1000), builtin: builtin.slice(0, 1000) }; }
        }
        window.ddcsResolveProbeSources = orig;
        return { studioDiffs, expertDiffs, firstDiff, registered: !!builderOf(OPTYPE) };
    }, OPTYPE);
    expect(r.registered, 'the twin is seeded/registered on boot').toBe(true);
    if (r.firstDiff) console.log('ATC-CHECK DIFF [' + r.firstDiff.profile + '] @ ' + JSON.stringify(r.firstDiff.p) + '\n--TWIN--\n' + r.firstDiff.twin + '\n--BUILTIN--\n' + r.firstDiff.builtin);
    expect(r.studioDiffs, 'STUDIO: twin emit == atcToolCheckStack (header recomposed for all scalars incl. tolerance)').toBe(0);
    expect(r.expertDiffs, 'EXPERT: twin emit == atcToolCheckStack (source-chips #5/#6 → registers)').toBe(0);
});

/**
 * t1900 — CROSS-DIALECT. `atcToolCheckStack` branches STRUCTURALLY on `hasCurrentTool` (t1894 — the fix this op's
 * own postInstantiate now fully recomposes from). "studio AND Expert" above never switches the ACTIVE DIALECT.
 * Every registered dialect, one representative param set.
 */
test('CROSS-DIALECT: the twin emit == atcToolCheckStack for EVERY registered dialect, incl. the refusal branch (t1900)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (OPTYPE) => {
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { atcToolCheckStack } = await import('/wizards/atcToolCheckWizard.js');
        const { ATC_CHECK_DEFAULTS, atcCheckDataDef } = await import('/blocks/dataOps/atcCheckData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        registerUserOp(atcCheckDataDef());   // the node tier never runs web/app.js's seedDefaultPortedUserOps()
        const { __setDialectOverrideForTests, listPosts } = await import('/wizards/dialects/index.js');   // t2137 — in-memory, test-only (see dialects/index.js)
        const dialects = listPosts().map((p) => p.id);
        let diffs = 0, first = null;
        for (const dialectId of dialects) {
            __setDialectOverrideForTests(dialectId);
            const twin = emitMapped(builderOf(OPTYPE)(ATC_CHECK_DEFAULTS)).text;
            const builtin = emitMapped(atcToolCheckStack(ATC_CHECK_DEFAULTS)).text;
            if (twin !== builtin) { diffs++; if (!first) first = { dialectId, twin: twin.slice(0, 600), builtin: builtin.slice(0, 600) }; }
        }
        __setDialectOverrideForTests(null);
        return { diffs, first, dialectCount: dialects.length };
    }, OPTYPE);
    if (r.first) console.log('ATC-CHECK XDIALECT DIFF ' + JSON.stringify(r.first.dialectId) + '\n--TWIN--\n' + r.first.twin + '\n--BUILTIN--\n' + r.first.builtin);
    expect(r.dialectCount, 'sanity: 7 registered dialects').toBe(7);
    expect(r.diffs, 'twin emit == atcToolCheckStack for EVERY registered dialect (byte-diff = ZERO), including the register-refusal branch').toBe(0);
});

test('opensAs wiring: ATC Tool Check opens the twin IN-PLACE (plain title, twin retired from atc_datawiz)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async (OPTYPE) => {
        const WL = await import('/blocks/wizardLibrary.js');
        const entries = WL.listEntries();
        const chk = entries.find((e) => e.id === 'atc_check');
        const twinEntry = entries.find((e) => e.type === OPTYPE);
        return { opensAs: chk && chk.opensAs, title: WL.builtinLabelForTwin(OPTYPE), twinRetired: !twinEntry };
    }, OPTYPE);
    expect(r.opensAs, 'the built-in ATC Tool Check entry opensAs the twin').toBe(OPTYPE);
    expect(r.title, 'the seamless in-place title is the built-in plain label').toBe('Tool Check');
    expect(r.twinRetired, "the twin's own atc_datawiz entry is retired").toBe(true);
});
