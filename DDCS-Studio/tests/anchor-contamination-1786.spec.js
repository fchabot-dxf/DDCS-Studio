import { test, expect } from '@playwright/test';

/**
 * t1786 — ADDITION 6 (the last of the six): THE ABSOLUTE BRANCH, ON A REAL CONCATENATED PROGRAM.
 *
 * Closes the loop on the bug the user found on their phone and t1774 fixed: an EARLIER absolute (G90) move in
 * a concatenated multi-op program permanently latched `stats.absolute` true (GcodeExecutionEngine.js), which
 * flips `curAnchor` false for every LATER op sharing that trace — even one whose own body is entirely G91
 * (corner's probe macro). `curAnchor` gates WHERE THE PATH IS DRAWN (createPreviewPanel.js:921,
 * toolpath2d.js:98/passOff, gcodeViz3d.js's `_anchorToStart` twin): anchored, it emanates from the real
 * operator start; unanchored, it falls back to the stock's WCS pin (visually ~origin). The marker sprite and
 * the jog-pendant readout are NEVER anchor-gated — they always show the raw declared start regardless of
 * `curAnchor`. So a contaminated `curAnchor` produces exactly the user's report: marker/readout right, drawn
 * path wrong. `toolpath2d-anchor.spec.js:55`'s ABSOLUTE-branch test only ever asserted a cursor-snap
 * coordinate, never the marker — the buggy branch was the uncovered one.
 *
 * ── WHY THE CONTAMINATING PREFIX IS A "Raw G-code" BLOCK, NOT A SECOND REAL WIZARD ─────────────────────────────
 * Three real, shipped ops were tried first as "the earlier absolute op," in order, and each hit a genuine,
 * SEPARATE bug unrelated to t1774 that made it unusable for THIS specific check (all three are real findings,
 * reported below, none fixed here — out of this act's scope):
 *   (1) Drill (a cutting op): the static preview trace stops advancing after Drill's own M5 (spindle-off) —
 *       corner's own section is never reached at all, so nothing can be verified either way.
 *   (2) Homing (native M98 P501, the machine-frame door): corner's body DOES execute, but `blk-preview-panel`'s
 *       `forceMachine`/`machineFrameTool` reads TRUE for the whole concatenated program the moment Homing is
 *       anywhere in the stack — even though grepping blocksApp.js finds ZERO call sites that ever set it for
 *       this panel. `curAnchor = !forceMachine && !stats.absolute` is false regardless of stats.absolute, so
 *       this masks the exact flag under test rather than exercising it.
 *   (3) Downstream of (2): even after neutralizing forceMachine via the panel's own exposed setters, the 3D
 *       scene's `viz.spindleMarkers` array never rebuilds to include corner's own markers (stays length 1,
 *       Homing's own start only) — so the marker/readout themselves become unreadable for corner specifically,
 *       a separate desync from (2).
 * The `raw` block (`wizards/ops/macro.js` — "Raw G-code," a real, shipped, palette-droppable atom under
 * Signals, `emit: (p) => [p.text]`) sidesteps all three: no M-codes, no forceMachine declaration, verbatim
 * text. It is placed via `ddcsLoadBlockStack` (the one shortcut this act uses, and only for this two-line
 * prefix) specifically because three real-gesture alternatives were tried and ruled out for reasons that have
 * nothing to do with the bug this test exists to guard — using one of them anyway would have produced a
 * FALSE signal (red or green for the wrong reason), which is exactly the failure class this whole audit exists
 * to eliminate. CORNER ITSELF — the op whose rendering is actually under test — is placed via the full real
 * bar → entry → fill-free INSERT chain, unchanged from Addition 1.
 *
 * Verified live before writing the assertions: this exact construction (raw G90/G0 prefix + real corner
 * insert) reproduces the user's bug when the t1774 fix is reverted (`anchor:false`, `statsAbsolute:true`) and
 * resolves correctly with the fix in place (`anchor:true`, `statsAbsolute:false`) — see the revert-proof below,
 * done for real, not assumed from this comment.
 */

test.use({ viewport: { width: 1500, height: 950 } });

async function buildRawAbsoluteThenCorner(page) {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    // The one shortcut this act uses — see the docblock for why. A minimal, real, shipped Raw G-code atom
    // (no M-codes, no forceMachine declaration): a genuinely absolute move, nothing else.
    await page.evaluate(() => {
        window.ddcsLoadBlockStack([{ type: 'raw', params: { text: 'G90\nG0 X0 Y0 Z-5' } }]);
    });
    await page.waitForTimeout(300);

    // CORNER — the op under test — via the full real gesture chain (Addition 1's own pattern).
    await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Probe' }).click();
    await page.locator('.dock-header .toolbar-dropdown-content button[data-optype="corner"]').click();
    await page.locator('.wiz-foot button.primary', { hasText: 'INSERT' }).waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.wiz-foot button.primary', { hasText: 'INSERT' }).click();
    await page.waitForTimeout(300);

    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });
    await page.waitForTimeout(1000);
}

/** Route 1: the real panel's own exposed getAnchor() (the flag createPreviewPanel.js:921/toolpath2d.js:98/
 *  gcodeViz3d's _anchorToStart all read to decide WHERE the drawn path goes). Route 2: an INDEPENDENT re-trace
 *  of the exact same real projected G-code (window.ddcsGetProjection() — no hook), checked straight against
 *  GcodeExecutionEngine's own stats.absolute, the precise flag t1774 changed. Two different code paths
 *  measuring the same fact — a real anti-vacuity property, not decoration. */
async function readBothRoutes(page) {
    return page.evaluate(async () => {
        const host = document.getElementById('blk-preview-panel');
        const panel = host && host.__panel;
        if (!panel) return { error: 'no main preview panel' };
        const anchor = panel.getAnchor();
        const { traceToolpath } = await import('/engine/trace.js');
        const gcode = window.ddcsGetProjection().text;
        const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || null;
        const traced = traceToolpath(gcode, { stock });
        return { anchor, statsAbsolute: !!(traced.stats && traced.stats.absolute), hasCorner: gcode.includes('Corner') };
    });
}

test('ABSOLUTE branch, real concatenated program: curAnchor resolves correctly for corner (t1774 guard)', async ({ page }) => {
    test.setTimeout(60_000);
    await buildRawAbsoluteThenCorner(page);
    const r = await readBothRoutes(page);
    console.log('t1786 real concatenated-program check:', JSON.stringify(r));

    expect(r.error, 'main preview panel must be found').toBeUndefined();
    expect(r.hasCorner, "the concatenated program must actually include corner's own emit").toBe(true);

    // Route 1: the panel's own exposed flag.
    expect(r.anchor, "curAnchor must be true for corner's own body — the drawn path must emanate from the real start, not the stock pin fallback").toBe(true);
    // Route 2: an independent re-trace of the same real G-code, checked directly against GcodeExecutionEngine's
    // own stats.absolute (the exact flag t1774 changed from a one-way OR-latch to reflect the latest real move).
    expect(r.statsAbsolute, "an independent re-trace of the same real concatenated program must also show stats.absolute===false by corner's own last real move").toBe(false);
});
