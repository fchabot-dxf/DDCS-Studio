import { test, expect } from '@playwright/test';

/**
 * ROTARY 2D DATUM-GLYPH (t465) — an opt-in, PURELY-VISUAL layout glyph for the rotary wizards, mirroring the edge
 * wall-glyph. rotaryCenter (a `diameter` binding) → the bar CENTRELINE (the rotary A-axis at the stock Y-centre) + a
 * dot at the bar centre (Z0). rotaryClock (a `span` binding) → the SPAN SEGMENT (the two Z-down touches A→B, span apart
 * in Y) + the two touch dots. Sim-only (items only; no handle/emit/drag) → BYTE-IDENTICAL emit; non-rotary ops untouched.
 *
 * VERIFY (assert-the-value): the glyph items render at the RIGHT datum position (independent truth: the bar axis = the
 * stock Y-centre; the clock touches = cy ± span/2, matching the rotary_clock sim-start); a non-rotary op (drill) has NO
 * rotary glyph; emit BYTE-IDENTICAL to the built-in rotaryCenterStack / rotaryClockStack.
 */
test('layoutSpecFromOp: rotaryCenter → centreline+datum at the bar axis; rotaryClock → span+touches at cy±span/2; drill → none', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetSettings);
    const r = await page.evaluate(async () => {
        const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
        const { listUserOps } = await import('/blocks/userOps.js');
        const defOf = (opType) => listUserOps().find((d) => d.opType === opType) || null;
        // a KNOWN stock so the positions are deterministic: 200×100 → the bar axis is Y=50, the centre is X=100
        const st = window.ddcsGetSettings().stock;
        for (const k of Object.keys(st)) delete st[k];
        Object.assign(st, { x: 200, y: 100, z: 76, shape: 'cylinder', datum: 'nnp' });

        const rotClass = (spec) => (spec.items || []).filter((it) => (it.cls || '').startsWith('fc-rotary-'));

        // (1) rotaryCenter — the bar CENTRELINE (a line at Y=50, full X) + a datum dot at the bar centre (100,50)
        const centerDef = defOf('user_rotary_center_data');
        const centerItems = rotClass(layoutSpecFromOp(centerDef, {}));
        const axis = centerItems.find((it) => it.cls === 'fc-rotary-axis');
        const cDatum = centerItems.find((it) => it.cls === 'fc-rotary-datum');

        // (2) rotaryClock — the SPAN segment (A→B, span apart in Y) + 2 touch dots. span=30 → ay=35, by=65
        const clockDef = defOf('user_rotary_clock_data');
        const clockItems = rotClass(layoutSpecFromOp(clockDef, { span: 30 }));
        const spanSeg = clockItems.find((it) => it.cls === 'fc-rotary-span');
        const touches = clockItems.filter((it) => it.cls === 'fc-rotary-touch');

        // (3) a NON-rotary op (drill) → NO rotary glyph (other ops untouched)
        const drillDef = defOf('user_drill_data');
        const drillRot = drillDef ? rotClass(layoutSpecFromOp(drillDef, {})).length : -1;

        return {
            hasCenterDef: !!centerDef, hasClockDef: !!clockDef, hasDrillDef: !!drillDef,
            axis, cDatum, spanSeg, touches, drillRot,
        };
    });
    console.log('ROTARY GLYPH: ' + JSON.stringify(r));
    expect(r.hasCenterDef && r.hasClockDef && r.hasDrillDef, 'the twins + drill are seeded').toBe(true);

    // rotaryCenter: the centreline runs along X at the stock Y-centre (50) — the bar axis IS the datum reference
    expect(r.axis, 'the centreline glyph renders').toBeTruthy();
    expect(r.axis.kind).toBe('line');
    expect(r.axis.y1, 'centreline Y == the bar axis (stock Y-centre = 50)').toBeCloseTo(50, 6);
    expect(r.axis.y2, 'centreline is horizontal (y1==y2)').toBeCloseTo(50, 6);
    expect(r.axis.x1, 'centreline spans the full X (0)').toBeCloseTo(0, 6);
    expect(r.axis.x2, 'centreline spans the full X (200)').toBeCloseTo(200, 6);
    expect(r.cDatum, 'the datum dot renders').toBeTruthy();
    expect(r.cDatum.kind).toBe('circle');
    expect(r.cDatum.cx, 'datum dot X == the bar centre (100)').toBeCloseTo(100, 6);
    expect(r.cDatum.cy, 'datum dot Y == the bar axis (50)').toBeCloseTo(50, 6);

    // rotaryClock: the span segment A→B at X=100, from cy-span/2 (35) to cy+span/2 (65); the touches at those ends
    expect(r.spanSeg, 'the span segment renders').toBeTruthy();
    expect(r.spanSeg.kind).toBe('line');
    expect(r.spanSeg.x1, 'span at X=centre (100)').toBeCloseTo(100, 6);
    expect(r.spanSeg.x2).toBeCloseTo(100, 6);
    expect(Math.min(r.spanSeg.y1, r.spanSeg.y2), 'touch A at cy-span/2 (50-15=35)').toBeCloseTo(35, 6);
    expect(Math.max(r.spanSeg.y1, r.spanSeg.y2), 'touch B at cy+span/2 (50+15=65)').toBeCloseTo(65, 6);
    expect(r.touches.length, 'two touch dots (A + B)').toBe(2);
    const ys = r.touches.map((t) => t.cy).sort((a, b) => a - b);
    expect(ys[0], 'touch A dot Y == 35').toBeCloseTo(35, 6);
    expect(ys[1], 'touch B dot Y == 65').toBeCloseTo(65, 6);

    // a non-rotary op is UNTOUCHED — no rotary glyph leaks onto it
    expect(r.drillRot, 'a NON-rotary op (drill) has ZERO rotary glyph items (the gate is opt-in)').toBe(0);
});

test('emit BYTE-IDENTICAL: the glyph is sim-only — rotary twins still == their built-in stacks across a sweep', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { rotaryCenterStack } = await import('/wizards/rotaryCenterWizard.js');
        const { rotaryClockStack } = await import('/wizards/rotaryClockWizard.js');
        const { ROTARY_CENTER_DEFAULTS } = await import('/blocks/dataOps/rotaryCenterData.js');
        const { ROTARY_CLOCK_DEFAULTS } = await import('/blocks/dataOps/rotaryClockData.js');
        const diff = (opType, stackFn, sweep) => {
            let diffs = 0, first = null;
            for (const p of sweep) {
                const twin = emitMapped(builderOf(opType)(p)).text;
                const builtin = emitMapped(stackFn(p)).text;
                if (twin !== builtin) { diffs++; if (!first) first = { p, twin: twin.slice(0, 600), builtin: builtin.slice(0, 600) }; }
            }
            return { diffs, first };
        };
        const center = diff('user_rotary_center_data', rotaryCenterStack, [
            ROTARY_CENTER_DEFAULTS,
            { ...ROTARY_CENTER_DEFAULTS, method: 'known', diameter: 40 },
            { ...ROTARY_CENTER_DEFAULTS, method: 'fit' },
            { ...ROTARY_CENTER_DEFAULTS, datum: 'top', safeZ: 20 },
        ]);
        const clock = diff('user_rotary_clock_data', rotaryClockStack, [
            ROTARY_CLOCK_DEFAULTS,
            { ...ROTARY_CLOCK_DEFAULTS, span: 30, action: 'set' },
            { ...ROTARY_CLOCK_DEFAULTS, action: 'report', reference: 'side' },
            { ...ROTARY_CLOCK_DEFAULTS, action: 'rotate' },
        ]);
        return { center, clock };
    });
    if (r.center.first) console.log('CENTER DIFF @ ' + JSON.stringify(r.center.first.p) + '\n--TWIN--\n' + r.center.first.twin + '\n--BUILTIN--\n' + r.center.first.builtin);
    if (r.clock.first) console.log('CLOCK DIFF @ ' + JSON.stringify(r.clock.first.p) + '\n--TWIN--\n' + r.clock.first.twin + '\n--BUILTIN--\n' + r.clock.first.builtin);
    expect(r.center.diffs, 'rotaryCenter twin emit is BYTE-IDENTICAL to rotaryCenterStack (the glyph is sim-only)').toBe(0);
    expect(r.clock.diffs, 'rotaryClock twin emit is BYTE-IDENTICAL to rotaryClockStack (the glyph is sim-only)').toBe(0);
});

test.use({ viewport: { width: 1400, height: 1000 } });
test('DRIVE THE APP: the rotary Centreline twin opens IN-PLACE with the 2D layout showing the fc-rotary-axis glyph; screenshot', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetSettings);
    await page.evaluate(() => {
        const st = window.ddcsGetSettings().stock;
        for (const k of Object.keys(st)) delete st[k];
        Object.assign(st, { x: 200, y: 90, z: 76, shape: 'cylinder', diameter: 90, datum: 'nnp' });
    });
    await page.evaluate(() => window.openWiz('user_rotary_center_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(600);
    const glyph = await page.evaluate(() => {
        const axis = document.querySelector('#wiz_user .feature-canvas .fc-rotary-axis, #wiz_user svg .fc-rotary-axis');
        const datum = document.querySelector('#wiz_user .fc-rotary-datum');
        return { hasAxis: !!axis, hasDatum: !!datum };
    });
    await page.locator('#wiz_user').screenshot({ path: 'scratchpad/rotary_center_glyph.png' });
    console.log('ROTARY CENTER 2D DRIVE: ' + JSON.stringify(glyph));
    expect(glyph.hasAxis, 'the rotary bar centreline glyph renders in the real 2D layout pane').toBe(true);
    expect(glyph.hasDatum, 'the rotary datum dot renders in the real 2D layout pane').toBe(true);
});
