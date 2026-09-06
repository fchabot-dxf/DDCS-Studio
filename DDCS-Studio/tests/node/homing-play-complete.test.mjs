import { test, expect } from './support/harness.mjs';

/**
 * t540 (0) STALL VERIFY — the NEW simple-G31 homing emit (b0a9791) must PLAY TO COMPLETION (no freeze, the human's line-8
 * stall was the OLD O501 GOTO wall). Trace the emitted macro through the engine, BOTH Z signs, WITH + WITHOUT a stock shown:
 * it completes (finite end pos, no infinite loop → trace returns) and the tool ends near the declared TOP, not overshooting.
 *
 * t2695 — TIER MIGRATION BATCH 5: moved browser→node. This file was listed in the dispatch's own SKIP list (grouped
 * with the genuinely UI-driving preview/marker files by name association) — reading it found it is actually a pure
 * `homingStack`+`emitMapped`+`GcodeExecutionEngine` trace test, no DOM at all. A misclassification the shape-gate
 * caught, corrected here (the opposite direction from this batch's other correction, `homing-derived-home-end`/
 * `homing-refusal-reaches-twin-1898`/`homing-pin-audit`, which the dispatch listed as MOVE candidates but are 100%
 * real-app UI).
 */
test('(0) the simple-G31 homing emit traces to completion (no freeze), both signs, stock shown + hidden; tool ends at the top', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { homingStack } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { GcodeExecutionEngine } = await import('/engine/index.js');
        const cfg = (z) => ({ axes: ['z'], config: { z: { enable: true, order: 1, seekFeed: 800, slowFeed: 100, backoff: 5 } }, machine: { x: 600, y: 600, z }, limits: { zMaxHome: true } });
        const play = (z, stock) => {
            window.ddcsGetSettings = () => ({ machine: { x: 600, y: 600, z, softLimits: true }, homing: { axes: {} }, stock: { show: !!stock }, limits: { zMaxHome: true } });
            const code = emitMapped(homingStack(cfg(z))).text + '\nM30\n';
            const eng = new GcodeExecutionEngine(stock ? { autoAnswer: true, stock: { x: 200, y: 100, z: 25, show: true } } : { autoAnswer: true });
            eng.trace(code);   // synchronous — an infinite loop (old GOTO wall) would HANG the test; the simple emit returns
            return { finite: Number.isFinite(eng.pos.z), z: Math.round(eng.pos.z * 10) / 10 };
        };
        return {
            negNoStock: play(-120, false), negStock: play(-120, true),
            posNoStock: play(500, false), posStock: play(500, true),
        };
    });
    console.log('PLAY (z end): ' + JSON.stringify(r));
    // completed (trace returned = no infinite loop = no freeze) + a finite end position, every combo
    for (const [k, v] of Object.entries(r)) expect(v.finite, `${k}: the emit plays to completion with a finite end Z (no freeze)`).toBe(true);
    // t540 clamp fix — z=+500 homes to the TOP (~495 = 500 top − backoff), NOT overshooting past it, EVEN with a stock shown
    expect(r.posNoStock.z, 'z=+500 no-stock ends at the top (~495), not overshot').toBeLessThanOrEqual(505);
    expect(r.posStock.z, 'z=+500 WITH a stock ALSO ends at the top (~495), not overshot to +517 (the clamp now applies)').toBeLessThanOrEqual(505);
    expect(r.posNoStock.z, 'z=+500 reaches near the top (not stuck low)').toBeGreaterThan(480);
    expect(r.posStock.z, 'z=+500 with stock reaches near the top').toBeGreaterThan(480);
});
