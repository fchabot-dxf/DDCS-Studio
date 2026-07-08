import { test, expect } from '@playwright/test';

/**
 * ALIGNMENT one-source probe points + AUTO/MANUAL travel — FOUNDATION (t506, increment A).
 * The 2 probe points are declared ONCE as fractions of the stock (alignPoints → params.ax/ay/bx/by). This spec pins the
 * DECLARE-side that every surface reads: (1) the SIM markers (opSimStarts) come from the source, not the old fixed 0.3/0.7;
 * (2) the emit AUTO mode rapids to those declared coords (safe-Z travel), MANUAL keeps the Confirm gates; (3) AUTO needs a
 * stock (no stock → MANUAL, byte-safe). The 2D-canvas 2-handle wiring + the data-op emit flow are the next increment (forks).
 */
test('opSimStarts.alignment reads the declared fraction source (not the fixed 0.3/0.7)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const { alignPoints, alignPointsXY } = await import('/wizards/ops/alignPoints.js');
        const { AlignmentWizard } = await import('/wizards/alignmentWizard.js');
        const w = new AlignmentWizard();
        const stock = { x: 150, y: 100, z: 25 };
        const def = w.inferStarts({ checkAxis: 'X' }, stock);                       // default fractions
        const dragged = w.inferStarts({ checkAxis: 'X', ax: 0.5, ay: 0.5 }, stock);  // point A dragged to the middle
        return {
            defFrac: alignPoints({ checkAxis: 'X' }),
            defA: { x: def[0].x, y: def[0].y }, defB: { x: def[1].x, y: def[1].y },
            dragA: { x: dragged[0].x, y: dragged[0].y },
            xy: alignPointsXY({ checkAxis: 'X', ax: 0.5 }, stock)[0],
        };
    });
    // default fractions reproduce the old spread (0.3/0.7 along X, 0.85 across) → the 2 markers stay where they were
    expect(r.defFrac[0]).toEqual({ fx: 0.3, fy: 0.85 });
    expect(r.defA).toEqual({ x: 45, y: 85 });    // 0.3*150, 0.85*100
    expect(r.defB).toEqual({ x: 105, y: 85 });   // 0.7*150
    // dragging point A's fraction MOVES the sim marker (the source drives the sim)
    expect(r.dragA).toEqual({ x: 75, y: 50 });   // 0.5*150, 0.5*100
    expect(r.xy).toEqual({ x: 75, y: 85 });      // ax overrides, ay defaults to 0.85
});

test('emit AUTO (default, with a stock) rapids to the declared point coords at safe-Z; MANUAL keeps the Confirm gates', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { alignmentStack } = await import('/wizards/alignmentWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const stock = { x: 150, y: 100, z: 25 };
        const auto = emitMapped(alignmentStack({ checkAxis: 'X', stock })).text;                         // default travel → AUTO (stock present)
        const dragged = emitMapped(alignmentStack({ checkAxis: 'X', ax: 0.5, stock })).text;             // A dragged → X moves to 75
        const manual = emitMapped(alignmentStack({ checkAxis: 'X', travel: 'manual', stock })).text;     // explicit MANUAL
        return { auto, dragged, manual };
    });
    // AUTO: rapids to the declared A/B coords (45/85, 105/85) at safe-Z — the moves match the handles, not any 0.3/0.7 magic
    expect(r.auto, 'AUTO announces the travel to the declared point A').toContain('AUTO travel to point A');
    expect(r.auto, 'AUTO rapids to point A X').toContain('X45');
    expect(r.auto, 'AUTO rapids to point A/B Y (0.85*100)').toContain('Y85');
    expect(r.auto, 'AUTO rapids to point B X (0.7*150)').toContain('X105');
    expect(r.auto, 'AUTO lifts to safe-Z (#19) between/before the points').toContain('Z#19');
    expect(r.auto, 'AUTO replaces the operator jog — no Confirm prompt').not.toContain('Press Enter when in position');
    // a dragged handle changes the emitted coord (one source → the emit)
    expect(r.dragged, 'dragging point A to fx=0.5 emits X75').toContain('X75');
    // MANUAL: the operator jogs + Confirm gates (byte-identical to today — the twin E1/E3 specs prove the full identity)
    expect(r.manual, 'MANUAL keeps the point-A Confirm gate').toContain('Press Enter when in position at point A');
    expect(r.manual, 'MANUAL does not auto-travel').not.toContain('AUTO travel to point');
});

test('AUTO needs a stock — no stock falls back to MANUAL (byte-safe, the emit never rapids to 0,0)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { alignmentStack } = await import('/wizards/alignmentWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const noStock = emitMapped(alignmentStack({ checkAxis: 'X' })).text;                    // default travel, NO stock
        const noStock0 = emitMapped(alignmentStack({ checkAxis: 'X', stock: { x: 0, y: 0 } })).text;  // degenerate stock
        return { noStock, noStock0 };
    });
    // with no usable stock, AUTO cannot resolve positions → MANUAL (Confirm gates), never an AUTO rapid to (0,0)
    expect(r.noStock, 'no stock → MANUAL Confirm gate').toContain('Press Enter when in position at point A');
    expect(r.noStock, 'no stock → no AUTO travel').not.toContain('AUTO travel to point');
    expect(r.noStock0, 'degenerate 0×0 stock → MANUAL, not an AUTO rapid to origin').toContain('Press Enter when in position at point A');
});

test('the one-source points + travel mode round-trip through the op marker codec (Blockly params)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { markerLine, parseMarker } = await import('/blocks/opSchema.js');
        const params = { checkAxis: 'X', probeDir: 'pos', travel: 'auto', ax: 0.5, ay: 0.6, bx: 0.7, by: 0.8, safeZ: 10, dist: 20 };
        const parsed = parseMarker(markerLine('alignment', params));
        const p = parsed && parsed.params || {};
        return { op: parsed && parsed.opType, travel: p.travel, ax: p.ax, ay: p.ay, bx: p.bx, by: p.by };
    });
    expect(r.op).toBe('alignment');
    expect(r.travel, 'travel mode round-trips').toBe('auto');
    expect({ ax: r.ax, ay: r.ay, bx: r.bx, by: r.by }, 'the 2 probe-point fractions round-trip').toEqual({ ax: 0.5, ay: 0.6, bx: 0.7, by: 0.8 });
});
