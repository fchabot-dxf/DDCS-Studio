import { test, expect } from '@playwright/test';

/**
 * ALIGNMENT geometry (t506 foundation, REDEFINED t544). The declared geometry is a SCALAR SPAN (mm along checkAxis) + a
 * sim-only A anchor — NOT two absolute points. This spec pins the DECLARE side: (1) the SIM markers (opSimStarts) = A (the
 * anchor fraction × stock) + B (A + the span along checkAxis); (2) the emit AUTO probes A IN PLACE (no travel/Confirm) then
 * does ONE relative checkAxis jog of the span to B; MANUAL keeps the Confirm gates; (3) AUTO no longer needs a stock (the
 * span is plain mm). The 2D-handle wiring (A = sim start, B = span) + the twin flow are the fork specs.
 */
test('opSimStarts.alignment = A (the anchor fraction) + B (A + the declared span along checkAxis)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { alignAnchor, alignMarkersXY, alignSpan } = await import('/wizards/ops/alignPoints.js');
        const { AlignmentWizard } = await import('/wizards/alignmentWizard.js');
        const w = new AlignmentWizard();
        const stock = { x: 150, y: 100, z: 25 };
        const def = w.inferStarts({ checkAxis: 'X', span: 50 }, stock);                 // default anchor + span 50
        const draggedA = w.inferStarts({ checkAxis: 'X', ax: 0.5, ay: 0.5, span: 50 }, stock);  // A anchor moved
        const biggerSpan = w.inferStarts({ checkAxis: 'X', span: 80 }, stock);          // span 80 → B moves
        return {
            anchorFrac: alignAnchor({ checkAxis: 'X' }),
            defA: { x: def[0].x, y: def[0].y }, defB: { x: def[1].x, y: def[1].y },
            dragA: { x: draggedA[0].x, y: draggedA[0].y }, dragAB: { x: draggedA[1].x, y: draggedA[1].y },
            spanB: { x: biggerSpan[1].x, y: biggerSpan[1].y },
            spanY: (() => { const [A, B] = alignMarkersXY({ checkAxis: 'Y', ax: 0.85, ay: 0.3, span: 40 }, stock); return { A, B }; })(),
        };
    });
    // A's anchor default (checkAxis X) = 0.3/0.85; B = A + span along X (checkAxis)
    expect(r.anchorFrac).toEqual({ fx: 0.3, fy: 0.85 });
    expect(r.defA).toEqual({ x: 45, y: 85 });          // 0.3*150, 0.85*100 — the anchor
    expect(r.defB).toEqual({ x: 95, y: 85 });          // A.x + span(50) = 45+50, same Y (span along X)
    // dragging A's anchor moves BOTH markers (B tracks A + span)
    expect(r.dragA).toEqual({ x: 75, y: 50 });         // 0.5*150, 0.5*100
    expect(r.dragAB).toEqual({ x: 125, y: 50 });       // A.x + span(50)
    // a bigger span moves ONLY B (A anchor fixed)
    expect(r.spanB).toEqual({ x: 125, y: 85 });        // 45 + 80
    // checkAxis Y → the span runs along Y (B = A + span in Y)
    expect(r.spanY.A).toEqual({ x: 127.5, y: 30 });    // 0.85*150, 0.3*100
    expect(r.spanY.B).toEqual({ x: 127.5, y: 70 });    // A.y + span(40)
});

test('emit AUTO probes A IN PLACE (no travel/Confirm) then a relative span jog to B; MANUAL keeps the Confirm gates', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { alignmentStack } = await import('/wizards/alignmentWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const auto = emitMapped(alignmentStack({ checkAxis: 'X', span: 60 })).text;            // default travel → AUTO
        const autoY = emitMapped(alignmentStack({ checkAxis: 'Y', span: 40 })).text;           // fence along Y → the jog is in Y
        const manual = emitMapped(alignmentStack({ checkAxis: 'X', travel: 'manual' })).text;  // explicit MANUAL
        return { auto, autoY, manual };
    });
    // AUTO point A: probe WHERE THE MACHINE IS — no travel, no Confirm gate
    expect(r.auto, 'AUTO probes A in place').toContain('probe point A in place');
    expect(r.auto, 'AUTO has no Confirm before A').not.toContain('Press Enter when in position at point A');
    expect(r.auto, 'AUTO does NOT rapid to an absolute XY point').not.toMatch(/G0 X\d|G0 Y\d/);
    // AUTO point B: the ONLY jog = a relative checkAxis move of exactly the declared span (#73)
    expect(r.auto, 'AUTO declares the span #73 = 60').toMatch(/#73\s*=\s*60/);
    expect(r.auto, 'AUTO steps the span as a relative X jog (checkAxis X)').toContain('G0 X#73');
    expect(r.autoY, 'checkAxis Y → the span jog is in Y').toContain('G0 Y#73');
    // MANUAL: the operator jogs + Confirm gates (byte-identical to today; no #73, no auto jog)
    expect(r.manual, 'MANUAL keeps the point-A Confirm gate').toContain('Press Enter when in position at point A');
    expect(r.manual, 'MANUAL has no span var').not.toContain('#73');
});

test('AUTO no longer needs a stock — the span is plain mm (emit is span-based whether or not a stock exists)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { alignmentStack } = await import('/wizards/alignmentWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const noStock = emitMapped(alignmentStack({ checkAxis: 'X', span: 55 })).text;                    // NO stock, default travel
        const withStock = emitMapped(alignmentStack({ checkAxis: 'X', span: 55, stock: { x: 150, y: 100 } })).text;
        return { noStock, withStock, same: noStock === withStock };
    });
    // AUTO emits the span jog with NO stock (the span is mm, not a fraction × stock) — no fall-back to MANUAL, no rapid to (0,0)
    expect(r.noStock, 'no stock → AUTO still emits (probe A in place + the span jog)').toContain('probe point A in place');
    expect(r.noStock, 'no stock → the span jog').toContain('G0 X#73');
    expect(r.noStock, 'no stock → NOT a MANUAL Confirm gate').not.toContain('Press Enter when in position at point A');
    // the stock is irrelevant to the AUTO emit now (the emit is byte-identical with or without a stock)
    expect(r.same, 'the AUTO emit is stock-independent (byte-identical with/without a stock)').toBe(true);
});

test('the span + A-anchor + travel mode round-trip through the op marker codec (Blockly params)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { markerLine, parseMarker } = await import('/blocks/opSchema.js');
        const params = { checkAxis: 'X', probeDir: 'pos', travel: 'auto', ax: 0.5, ay: 0.6, span: 65, safeZ: 10, dist: 20 };
        const parsed = parseMarker(markerLine('alignment', params));
        const p = parsed && parsed.params || {};
        return { op: parsed && parsed.opType, travel: p.travel, ax: p.ax, ay: p.ay, span: p.span };
    });
    expect(r.op).toBe('alignment');
    expect(r.travel, 'travel mode round-trips').toBe('auto');
    expect(r.span, 'the A→B span round-trips').toBe(65);
    expect({ ax: r.ax, ay: r.ay }, 'the sim-only A anchor round-trips').toEqual({ ax: 0.5, ay: 0.6 });
});
