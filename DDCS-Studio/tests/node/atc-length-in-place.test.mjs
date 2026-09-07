import { test, expect } from './support/harness.mjs';

/**
 * ATC TOOL LENGTH — light NEW port (t409; the pilot for the light-ATC-port recipe, Tool Check inherits it). A NEW twin
 * (user_atc_length_data) created via userOpFromStack + bindingSpecs by #var identity, then wired IN-PLACE (opensAs). The
 * two source-touches (corner precedent): the interpolated SUMMARY header RECOMPOSED from resolved params; the #5/#6
 * source-chips re-applied post-instantiate. VERIFY: emit BYTE-IDENTICAL to atcLengthStack across a scalar sweep on BOTH
 * profiles (studio AND Expert, source-resolver stubbed — the middle E1-fix precedent) · cross-dialect · in-place + plain title.
 *
 * TIER MIGRATION WORK PACKAGE D: moved browser→node. Three of the four tests moved — plain import()+evaluate over
 * declared builders/emitters/registries, no DOM. The file's 4th test ("DRIVE: ... a NON-EMPTY form + the 3D machine
 * sim renders") opens the twin via window.openWiz, reads real DOM, and screenshots the panel — a genuine app+DOM
 * dependency, not a candidate for this tier. Split into tests/atc-length-in-place-drive.spec.js. Both moved
 * emit-comparison tests explicitly `registerUserOp(atcLengthDataDef())` the twin, since the node tier never runs
 * web/app.js's seedDefaultPortedUserOps() that seeds it in the browser.
 */
const OPTYPE = 'user_atc_length_data';

test('emit BYTE-IDENTICAL to atcLengthStack across a scalar sweep — studio AND Expert (source-resolver stubbed ON)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (OPTYPE) => {
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { atcLengthStack } = await import('/wizards/atcLengthWizard.js');
        const { ATC_LENGTH_DEFAULTS, atcLengthDataDef } = await import('/blocks/dataOps/atcLengthData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        registerUserOp(atcLengthDataDef());   // the node tier never runs web/app.js's seedDefaultPortedUserOps()
        const sweep = [
            ATC_LENGTH_DEFAULTS,
            { ...ATC_LENGTH_DEFAULTS, blockHeight: 60, safeZ: 15 },
            { ...ATC_LENGTH_DEFAULTS, maxDist: 120, retract: 5, f_fast: 400, f_slow: 40 },
            { ...ATC_LENGTH_DEFAULTS, port: 3, blockHeight: 25.4 },
        ];
        const orig = window.ddcsResolveProbeSources;
        let studioDiffs = 0, expertDiffs = 0, firstDiff = null;
        // STUDIO — the resolver returns no native registers → the source-chips stay literal
        window.ddcsResolveProbeSources = () => ({});
        for (const p of sweep) {
            const twin = emitMapped(builderOf(OPTYPE)(p)).text;
            const builtin = emitMapped(atcLengthStack(p)).text;
            if (twin !== builtin) { studioDiffs++; if (!firstDiff) firstDiff = { profile: 'studio', p, twin: twin.slice(0, 1000), builtin: builtin.slice(0, 1000) }; }
        }
        // EXPERT — stub the resolver ON: #5 (setterPort) + #6 (blockHeight) resolve to controller registers
        const REG = { setterPort: '#1078', blockHeight: '#1170' };
        window.ddcsResolveProbeSources = () => ({ ...REG });
        for (const p of sweep) {
            const twin = emitMapped(builderOf(OPTYPE)(p)).text;
            const builtin = emitMapped(atcLengthStack({ ...p, sources: { ...REG } })).text;
            if (twin !== builtin) { expertDiffs++; if (!firstDiff) firstDiff = { profile: 'expert', p, twin: twin.slice(0, 1000), builtin: builtin.slice(0, 1000) }; }
        }
        window.ddcsResolveProbeSources = orig;
        return { studioDiffs, expertDiffs, firstDiff, registered: !!builderOf(OPTYPE) };
    }, OPTYPE);
    expect(r.registered, 'the twin is seeded/registered on boot').toBe(true);
    if (r.firstDiff) console.log('ATC-LENGTH DIFF [' + r.firstDiff.profile + '] @ ' + JSON.stringify(r.firstDiff.p) + '\n--TWIN--\n' + r.firstDiff.twin + '\n--BUILTIN--\n' + r.firstDiff.builtin);
    expect(r.studioDiffs, 'STUDIO: the twin emit == atcLengthStack (header recomposed for all scalars; source-chips literal)').toBe(0);
    expect(r.expertDiffs, 'EXPERT: the twin emit == atcLengthStack (source-chips #5/#6 → registers, matching the built-in srcVal/srcNote)').toBe(0);
});

/**
 * t1900 — CROSS-DIALECT. `atcLengthStack` branches STRUCTURALLY on `hasCurrentTool` (t1894 — the register-refusal
 * fix this op's own postInstantiate now fully recomposes from). "studio AND Expert" above never actually switches
 * the ACTIVE DIALECT — this is the exact blind spot t1896's census named. Every registered dialect, a small
 * representative param set (not the full 4-combo sweep × 7 — the point is catching the class, not adding runs).
 */
test('CROSS-DIALECT: the twin emit == atcLengthStack for EVERY registered dialect, incl. the refusal branch (t1900)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (OPTYPE) => {
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { atcLengthStack } = await import('/wizards/atcLengthWizard.js');
        const { ATC_LENGTH_DEFAULTS, atcLengthDataDef } = await import('/blocks/dataOps/atcLengthData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        registerUserOp(atcLengthDataDef());   // the node tier never runs web/app.js's seedDefaultPortedUserOps()
        const { __setDialectOverrideForTests, listPosts } = await import('/wizards/dialects/index.js');   // t2137 — in-memory, test-only (see dialects/index.js)
        const dialects = listPosts().map((p) => p.id);
        let diffs = 0, first = null;
        for (const dialectId of dialects) {
            __setDialectOverrideForTests(dialectId);
            const twin = emitMapped(builderOf(OPTYPE)(ATC_LENGTH_DEFAULTS)).text;
            const builtin = emitMapped(atcLengthStack(ATC_LENGTH_DEFAULTS)).text;
            if (twin !== builtin) { diffs++; if (!first) first = { dialectId, twin: twin.slice(0, 600), builtin: builtin.slice(0, 600) }; }
        }
        __setDialectOverrideForTests(null);
        return { diffs, first, dialectCount: dialects.length };
    }, OPTYPE);
    if (r.first) console.log('ATC-LENGTH XDIALECT DIFF ' + JSON.stringify(r.first.dialectId) + '\n--TWIN--\n' + r.first.twin + '\n--BUILTIN--\n' + r.first.builtin);
    expect(r.dialectCount, 'sanity: 7 registered dialects').toBe(7);
    expect(r.diffs, 'twin emit == atcLengthStack for EVERY registered dialect (byte-diff = ZERO), including the register-refusal branch').toBe(0);
});

test('opensAs wiring: ATC Tool Length opens the twin IN-PLACE (plain title, twin retired from atc_datawiz)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async (OPTYPE) => {
        const WL = await import('/blocks/wizardLibrary.js');
        const entries = WL.listEntries();
        const len = entries.find((e) => e.id === 'atc_length');
        const twinEntry = entries.find((e) => e.type === OPTYPE);
        return { opensAs: len && len.opensAs, title: WL.builtinLabelForTwin(OPTYPE), twinRetired: !twinEntry };
    }, OPTYPE);
    expect(r.opensAs, 'the built-in ATC Tool Length entry opensAs the twin').toBe(OPTYPE);
    expect(r.title, 'the seamless in-place title is the built-in plain label').toBe('Tool Length');
    expect(r.twinRetired, "the twin's own atc_datawiz entry is retired (one-source hide)").toBe(true);
});
