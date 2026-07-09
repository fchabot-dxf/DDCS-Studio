import { test, expect } from '@playwright/test';

/**
 * ALIGNMENT Fork 2 (t510, REDEFINED t544) — the AUTO emit flows through the TWIN (user_alignment_data), NOT the JS builder
 * (wizards-as-data M2). t544: AUTO probes A in place + steps the DECLARED SPAN (#73) as a relative checkAxis jog. The span is
 * a plain scalar bound by the #73 value binding (no stock, no coord recompose — applyAlignAutoTravel is DELETED). VERIFY:
 * (a) the TWIN AUTO emit == alignmentStack AUTO byte-for-byte (studio + Expert); MANUAL byte-identical; (b) the SPAN field
 * drives the TWIN emit (#73); (c) the A anchor (ax/ay) is sim-only — never in the emit; (d) AUTO needs NO stock.
 */
test('the twin AUTO emit == alignmentStack (span model, studio + Expert); the SPAN drives #73; the A anchor is sim-only', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { alignmentDataDef, ALIGNMENT_DEFAULTS } = await import('/blocks/dataOps/alignmentData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { alignmentStack } = await import('/wizards/alignmentWizard.js');
        registerUserOp(alignmentDataDef());
        const build = builderOf('user_alignment_data');
        const D = ALIGNMENT_DEFAULTS;

        // (a) byte-identity — twin == alignmentStack, AUTO + MANUAL, studio + Expert. NO stock needed (span is plain mm).
        const combos = [
            { ...D, travel: 'auto', checkAxis: 'X', probeDir: 'pos', span: 60 },
            { ...D, travel: 'auto', checkAxis: 'Y', probeDir: 'neg', span: 40, safeZ: 20 },
            { ...D, travel: 'auto', span: 25, safeZFrame: 'machine' },
            { ...D, travel: 'manual', checkAxis: 'X', probeDir: 'pos' },
            { ...D, travel: 'manual', checkAxis: 'Y', probeDir: 'neg' },
        ];
        const orig = window.ddcsResolveProbeSources;
        let studioDiffs = 0, expertDiffs = 0, firstDiff = null;
        const cmp = (label, srcObj) => {
            window.ddcsResolveProbeSources = () => srcObj;
            for (const c of combos) {
                const twin = emitMapped(build(c)).text;
                const builtin = emitMapped(alignmentStack({ ...c, sources: srcObj && Object.keys(srcObj).length ? srcObj : undefined })).text;
                if (twin !== builtin) { if (label === 'studio') studioDiffs++; else expertDiffs++; if (!firstDiff) { const tl = twin.split('\n'), bl = builtin.split('\n'); let li = 0; while (li < tl.length && tl[li] === bl[li]) li++; firstDiff = { label, c, line: li, twin: tl.slice(li, li + 3), builtin: bl.slice(li, li + 3) }; } }
            }
        };
        cmp('studio', {});
        cmp('expert', { port: '#1078', fastFeed: '#1080', retract: '#1082' });
        window.ddcsResolveProbeSources = orig;

        // (b) the SPAN field drives the twin #73 emit; (c) the A anchor (ax/ay) is sim-only → NOT in the emit
        const span25 = emitMapped(build({ ...D, travel: 'auto', span: 25 })).text;
        const span75 = emitMapped(build({ ...D, travel: 'auto', span: 75 })).text;
        const aMoved = emitMapped(build({ ...D, travel: 'auto', span: 25, ax: 0.9, ay: 0.1 })).text;

        return {
            studioDiffs, expertDiffs, firstDiff,
            autoInPlace: /probe point A in place/.test(span25), autoNoConfirm: !/Press Enter when in position/.test(span25),
            spanDrivesEmit: /#73=25/.test(span25) && /#73=75/.test(span75),
            aAnchorSimOnly: span25 === aMoved,
        };
    });
    if (r.firstDiff) console.log('FORK2 DIFF [' + r.firstDiff.label + '] ' + JSON.stringify(r.firstDiff.c) + ' @line ' + r.firstDiff.line + '\n--TWIN--\n' + (r.firstDiff.twin || []).join('\n') + '\n--BUILTIN--\n' + (r.firstDiff.builtin || []).join('\n'));
    expect(r.studioDiffs, 'STUDIO: twin AUTO/MANUAL emit == alignmentStack (byte-diff ZERO) — the span is a #73 scalar binding').toBe(0);
    expect(r.expertDiffs, 'EXPERT: byte-diff ZERO (the source-chips too)').toBe(0);
    expect(r.autoInPlace, 'the twin AUTO probes A in place (no travel)').toBe(true);
    expect(r.autoNoConfirm, 'AUTO has NO operator Confirm gate').toBe(true);
    expect(r.spanDrivesEmit, 'the SPAN field drives the TWIN #73 emit (25→75)').toBe(true);
    expect(r.aAnchorSimOnly, 'the A anchor (ax/ay) is SIM-ONLY — dragging it does NOT change the emit').toBe(true);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('REAL APP: the in-place form shows the Travel toggle + a Span field; AUTO no longer greys without a stock (t544)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 0, y: 0, show: false } }); });   // NO stock
    await page.evaluate(() => window.openWiz('user_alignment_data'));
    await page.waitForSelector('#wiz_user_form [data-param="travel"]', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
        const a = document.querySelector('#wiz_user_form [data-param="travel"] [data-value="auto"]');
        const spanFld = document.querySelector('#wiz_user_form [data-param="span"]');
        return { autoPresent: !!a, autoDisabled: !!(a && a.disabled), autoGated: a && a.getAttribute('data-op-gated'), spanPresent: !!spanFld };
    });
    await page.locator('#wiz_user_form').screenshot({ path: 'scratchpad/alignment_travel_no_gate.png' });
    // AUTO is a real segment, ENABLED even with no stock (the span is plain mm — no stock dependency)
    expect(r.autoPresent, 'the Travel toggle renders an AUTO segment').toBe(true);
    expect(r.autoDisabled, 'no stock → AUTO is NOT greyed (t544 — AUTO needs no stock)').toBe(false);
    expect(r.autoGated, 'no stock → AUTO is NOT data-op-gated').not.toBe('on');
    // the Span field is present (the declared A→B geometry)
    expect(r.spanPresent, 'the form shows the A→B Span field').toBe(true);
});
