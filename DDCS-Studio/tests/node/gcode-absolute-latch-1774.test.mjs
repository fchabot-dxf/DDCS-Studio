import { test, expect } from './support/harness.mjs';

/**
 * t1774 — THE ANCHOR-CONTAMINATION FIX. The user reported corner's preview drawing the start marker at what
 * "looks like 0,0,0" while the DRO reads the real, correct value. Traced live (createPreviewPanel.js:921's
 * curAnchor, toolpath2d.js:98's stockPin() fallback, gcodeViz3d's twin) to GcodeExecutionEngine.js's
 * `stats.absolute`: a ONE-WAY LATCH ("was the program EVER absolute") over the WHOLE trace. That is correct for
 * a single op's own G-code (a mill program stays G90 throughout), but the Blocks-tab main preview traces a
 * CONCATENATED multi-op program (getProjection().text). An EARLIER op's genuine absolute (G90) move — or a
 * native-homing move, which sets the same flag — permanently poisoned every LATER op's own curAnchor, even one
 * whose own macro is entirely G91 (corner's probe body never touches G90 except a trailing footer + G53-wrapped
 * retracts, both already excluded/inert). Fixed by making stats.absolute reflect the mode at the LATEST real
 * (non-G53) move rather than latching true forever — see the t1774 comment at GcodeExecutionEngine.js.
 *
 * Uses only SYNTHETIC G-code (a bare G90 rapid, a bare G91 probe-style move) — no values from any real user
 * workspace, per this act's privacy constraint.
 */

const ABSOLUTE_SNIPPET = 'G90\nG0 X10 Y10 Z5\n';
const INCREMENTAL_SNIPPET = 'G91\nG0 Y-5\nG31 Y10 F50 P1 L0 Q1\nG0 Y5\nM30\n';

test('an op preceded by an earlier absolute (or homed) move still reports its OWN incremental mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, null, { timeout: 30000 });

    const result = await page.evaluate(async ({ ABS, INC }) => {
        const { traceToolpath } = await import('/engine/trace.js');
        const stock = { x: 100, y: 80, z: 20 };
        const solo = traceToolpath(INC, { stock, start: { x: 0, y: 0, z: 0 } });
        const primed = traceToolpath(ABS + INC, { stock, start: { x: 0, y: 0, z: 0 } });
        const absoluteAlone = traceToolpath(ABS, { stock, start: { x: 0, y: 0, z: 0 } });
        return {
            soloAbsolute: !!(solo.stats && solo.stats.absolute),
            primedAbsolute: !!(primed.stats && primed.stats.absolute),
            absoluteAloneAbsolute: !!(absoluteAlone.stats && absoluteAlone.stats.absolute),
        };
    }, { ABS: ABSOLUTE_SNIPPET, INC: INCREMENTAL_SNIPPET });

    expect(result.soloAbsolute, 'an incremental-only trace is never absolute').toBe(false);
    expect(result.primedAbsolute, 'an EARLIER absolute move must not poison a LATER op\'s own incremental mode').toBe(false);
    expect(result.absoluteAloneAbsolute, 'a genuinely absolute program must still report absolute (no regression)').toBe(true);
});
