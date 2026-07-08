import { test, expect } from '@playwright/test';

/**
 * ALIGNMENT Fork 2 (t510) — the AUTO emit flows through the TWIN (user_alignment_data), NOT the JS builder (wizards-as-data
 * M2). The superset carries GUARDED travel arms; a postInstantiate applyAlignAutoTravel BINDS the AUTO travel-move coords
 * from the op's stock (getWorkpiece) × the fraction params. VERIFY: (a) the TWIN AUTO emit == alignmentStack AUTO byte-for-
 * byte (studio + Expert) WITH a stock, and MANUAL (byte-identical) WITHOUT; (b) a dragged fraction changes the TWIN emit coord
 * (one source → the twin, not just the JS builder). This COMPLETES Alignment (the E0-E3 MANUAL byte-identity stays green).
 */
test('the twin emits AUTO byte-identical to alignmentStack (with a stock) + MANUAL (without); a dragged fraction moves the twin AUTO coord', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { alignmentDataDef, ALIGNMENT_DEFAULTS } = await import('/blocks/dataOps/alignmentData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { alignmentStack } = await import('/wizards/alignmentWizard.js');
        const { getWorkpiece } = await import('/engine/workpiece.js');
        const SP = await import('/ui/settingsPanel.js');
        registerUserOp(alignmentDataDef());
        const build = builderOf('user_alignment_data');
        const D = ALIGNMENT_DEFAULTS;

        SP.applySettings({ stock: { x: 150, y: 100, z: 25, shape: 'box', show: true } });   // the twin reads getWorkpiece() (this global stock)
        const wpStock = getWorkpiece().outer;   // the SAME stock the twin binds → feed it to alignmentStack so both agree

        // (a) AUTO byte-identity — twin (global stock) == alignmentStack AUTO (same stock), studio + Expert
        const autoCombos = [
            { ...D, travel: 'auto', checkAxis: 'X', probeDir: 'pos', ax: 0.3, ay: 0.85, bx: 0.7, by: 0.85 },
            { ...D, travel: 'auto', checkAxis: 'Y', probeDir: 'neg', ax: 0.85, ay: 0.3, bx: 0.85, by: 0.7 },
            { ...D, travel: 'auto', ax: 0.5, ay: 0.5, bx: 0.6, by: 0.4, safeZ: 20 },
        ];
        const orig = window.ddcsResolveProbeSources;
        let studioDiffs = 0, expertDiffs = 0, firstDiff = null;
        const cmp = (label, srcObj) => {
            window.ddcsResolveProbeSources = () => srcObj;
            for (const c of autoCombos) {
                const twin = emitMapped(build(c)).text;
                const builtin = emitMapped(alignmentStack({ ...c, stock: wpStock, sources: srcObj && Object.keys(srcObj).length ? srcObj : undefined })).text;
                if (twin !== builtin) { if (label === 'studio') studioDiffs++; else expertDiffs++; if (!firstDiff) { const tl = twin.split('\n'), bl = builtin.split('\n'); let li = 0; while (li < tl.length && tl[li] === bl[li]) li++; firstDiff = { label, c, line: li, twin: tl.slice(li, li + 3), builtin: bl.slice(li, li + 3) }; } }
            }
        };
        cmp('studio', {});
        cmp('expert', { port: '#1078', fastFeed: '#1080', retract: '#1082' });
        window.ddcsResolveProbeSources = orig;

        // (b) a dragged fraction (ax 0.3 → 0.5) changes the TWIN emitted X (45 → 75) — the one source drives the twin emit
        const twinA03 = emitMapped(build({ ...D, travel: 'auto', ax: 0.3 })).text;
        const twinA05 = emitMapped(build({ ...D, travel: 'auto', ax: 0.5 })).text;

        // WITHOUT a usable stock → the twin emits MANUAL (byte-identical to alignmentStack MANUAL — E1/E3 preserved)
        SP.applySettings({ stock: { x: 0, y: 0, show: false } });
        const twinNoStock = emitMapped(build({ ...D, travel: 'auto' })).text;   // travel=auto but no stock → effective MANUAL
        const manualBuiltin = emitMapped(alignmentStack({ ...D, travel: 'manual' })).text;

        return {
            studioDiffs, expertDiffs, firstDiff,
            autoHasTravel: /X45/.test(twinA03), autoNoConfirm: !/Press Enter when in position/.test(twinA03),
            dragChangesEmit: /X45/.test(twinA03) && /X75/.test(twinA05),
            noStockIsManual: /Press Enter when in position at point A/.test(twinNoStock) && !/AUTO travel to point/.test(twinNoStock),
            noStockEqManual: twinNoStock === manualBuiltin,
            autoEmit: twinA03.split('\n').filter((l) => /POINT A|AUTO travel|G0 |G31 /.test(l)).slice(0, 6),
        };
    });
    if (r.firstDiff) console.log('FORK2 DIFF [' + r.firstDiff.label + '] ' + JSON.stringify(r.firstDiff.c) + ' @line ' + r.firstDiff.line + '\n--TWIN--\n' + (r.firstDiff.twin || []).join('\n') + '\n--BUILTIN--\n' + (r.firstDiff.builtin || []).join('\n'));
    console.log('TWIN AUTO emit sample:\n' + (r.autoEmit || []).join('\n'));
    expect(r.studioDiffs, 'STUDIO: the twin AUTO emit == alignmentStack AUTO (byte-diff ZERO) — the twin binds the coords from its stock').toBe(0);
    expect(r.expertDiffs, 'EXPERT: byte-diff ZERO (the source-chips too)').toBe(0);
    expect(r.autoHasTravel, 'the twin AUTO emit rapids to the declared coord (X45)').toBe(true);
    expect(r.autoNoConfirm, 'AUTO has NO operator Confirm gate').toBe(true);
    expect(r.dragChangesEmit, 'a dragged fraction (ax 0.3→0.5) changes the TWIN emit coord (X45→X75) — one source → the twin emit').toBe(true);
    expect(r.noStockIsManual, 'no usable stock → the twin emits MANUAL (Confirm gate, no AUTO travel)').toBe(true);
    expect(r.noStockEqManual, 'no-stock twin emit == alignmentStack MANUAL (byte-identical — E1/E3 preserved)').toBe(true);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('REAL APP: the in-place form shows the Travel toggle; AUTO greys with no stock (tooltip) + re-enables when a stock is placed', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 0, y: 0, show: false } }); });   // NO stock
    await page.evaluate(() => window.openWiz('user_alignment_data'));
    await page.waitForSelector('#wiz_user_form [data-param="travel"]', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(150);
    const noStock = await page.evaluate(() => { const a = document.querySelector('#wiz_user_form [data-param="travel"] [data-value="auto"]'); return { present: !!a, disabled: !!(a && a.disabled), gated: a && a.getAttribute('data-op-gated'), title: (a && a.title) || '' }; });
    await page.locator('#wiz_user_form [data-param="travel"]').screenshot({ path: 'scratchpad/alignment_travel_gated.png' });
    // place a stock → AUTO re-enables (dynamic via the settings-changed event)
    await page.evaluate(async () => { const SP = await import('/ui/settingsPanel.js'); SP.applySettings({ stock: { x: 200, y: 120, z: 30, shape: 'box', show: true } }); });
    await page.waitForTimeout(250);
    const withStock = await page.evaluate(() => { const a = document.querySelector('#wiz_user_form [data-param="travel"] [data-value="auto"]'); return { disabled: !!(a && a.disabled), gated: a && a.getAttribute('data-op-gated') }; });
    await page.locator('#wiz_user_form [data-param="travel"]').screenshot({ path: 'scratchpad/alignment_travel_enabled.png' });
    expect(noStock.present, 'the Travel toggle renders an AUTO segment').toBe(true);
    expect(noStock.disabled, 'no stock → AUTO greyed (disabled)').toBe(true);
    expect(noStock.gated, 'no stock → AUTO data-op-gated ON (survives postGating)').toBe('on');
    expect(noStock.title.toLowerCase(), 'greyed AUTO has a place-a-stock tooltip').toContain('stock');
    expect(withStock.disabled, 'placing a stock re-enables AUTO (dynamic)').toBe(false);
    expect(withStock.gated, 'stock → AUTO ungated').toBe('off');
});
