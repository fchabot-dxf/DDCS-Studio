import { test, expect } from '@playwright/test';

/**
 * t1836→t1838→t1872→t1874 — Option B, SLICE 3 of 3: LIVE VISIBILITY (the reason B exists). While PLAYBACK
 * executes a machine-frame segment (Homing, ATC…), the workpiece is HIDDEN — it may not even be loaded during a
 * machine-frame move, and the appearing/disappearing IS the operator's cue for which frame the machine is in
 * (their own ruling, their words — not a flicker to smooth, no fade/ghost/dim). A part-frame segment SHOWS it.
 * The IDLE picture (before play, or after STOP resets to it) is UNCHANGED — only PLAY, mid-machine-frame-segment,
 * ever hides it.
 *
 * FIRST QUESTION ANSWERED (the advisor's own gate before building anything): is `viz/segmentFrame.js` (Slice 1)
 * orphaned? NO — Slice 2 needed a per-PASS lookup (a different domain: `this.starts[p]`/`s.pass`, the trace
 * engine's own `_pass` counter), so it built its own additive tag and never imported Slice 1 at all. Slice 3 is
 * the module's FIRST real consumer: live playback is inherently LINE-indexed (the engine's own `onLineChange`,
 * `GcodeExecutionEngine.js:624`), exactly Slice 1's own domain — `frameOwnerAtLine(lineIndex)` is imported and
 * called directly, no contortion, confirmed by reading the fit before writing a line of Slice 3 itself.
 *
 * THE FIX — 3 files, additive, the union (Bug 2/t1832/t1834's own mechanism — forceMachine, seatAtStart, stock-
 * hiding for COLLISION purposes) left completely untouched:
 *   - `gcodeViz3d.js`: `setPlayFrameHidden(hidden)` — a new instance flag (`_playFrameStockHidden`, starts false)
 *     folded into `applyDisplay()`'s own existing stock-visibility gate (composes with the user's OWN stock
 *     on/off preference — this can't force it on if the user already hid stock entirely).
 *   - `createPreviewPanel.js`: `onLineChange` calls `frameOwnerAtLine(lineIndex)` and toggles the flag whenever
 *     it can attribute the line (null → leave the current visibility alone, no false hide). `stopPlay()` resets
 *     the flag to false (STOP already lands on the idle picture per the panel's own Run/Stop — no separate
 *     freeze state invented, per the advisor's own explicit instruction).
 *   - The SAME per-line lookup answers the 5th consumer (DRO frame-labeling, t1862's own deferred item — decided
 *     IN this slice, not Slice 3-adjacent-but-separate: it is literally the same question, "which frame does the
 *     line CURRENTLY executing belong to," just applied to the chip's text instead of the stock mesh visibility):
 *     `onPositionChange`'s own `machineOp` computation now reads `frameOwnerAtLine(lastLineIndex)` first, falling
 *     back to the untouched whole-trace flag when it returns null.
 *
 * NON-VACUITY (see WORK-LOG t1874 for the exact revert/restore counts): reverting the ONE `onLineChange` tagging
 * line makes the PRIMARY EVIDENCE test below fail with `hidden` staying `false` throughout Homing's own lines
 * (the whole-trace flag, while still true panel-wide from the union, is never consulted by the OLD code at all —
 * `setPlayFrameHidden` simply never gets called pre-fix).
 *
 * A PRE-EXISTING, SEPARATE FINDING, REPORTED NOT FIXED: the shared execution engine halts UNCONDITIONALLY at any
 * M30/M02/M99 line (`GcodeExecutionEngine.js:898`, `return true` = program complete) — every wizard-generated op
 * emits a standalone M30 by convention, so a REAL multi-op Blocks-tab program can never PLAY/STEP past the first
 * op's own M30 today, independent of Option B entirely. This blocks a live, end-to-end demonstration of a full
 * multi-op RUN in the real app (the projected G-code is 124+ lines and correct; the LIVE RUN stops after op 1).
 * The test below works around this for TEST PURPOSES ONLY (directly strips the one intermediate M30 from the
 * shared live projection before stepping) to exercise Slice 3's own mechanism across a genuine op boundary —
 * this does not change any shipped behavior; it is a test-construction choice, clearly not a source fix. Whether
 * multi-op Blocks programs SHOULD strip intermediate M30s to become genuinely continuously-playable is a
 * separate, bigger architectural question, out of Slice 3's own scope — flagged for the advisor, not resolved.
 *
 * DRO CHIP (the 5th consumer): the work→mach transition (Homing's own FIRST real motion, line ~4) is observed
 * live below — proof the wiring reads the per-line override, not merely re-confirming Homing's own union value
 * (which is already true regardless). The REVERSE transition (mach→work, into the part-frame op's own first
 * real motion) needed impractically many step-clicks to reach within a reliable test runtime in EVERY op
 * combination tried (Corner: ~63 steps; Edge: ~56 steps predicted by raw line count, but PROBE step semantics
 * did not match that prediction within 60 real clicks — G31 probe-seek lines appear to consume more than one
 * internal step each while stepped) — NOT independently live-verified this turn. Code-reviewed instead: it is
 * the SAME `frameOwnerAtLine`-with-fallback pattern as the stock toggle, which IS fully round-trip verified
 * below — named as an honest gap, not silently claimed as proven.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

async function mkOp(page, opType, n) {
    return page.evaluate(async ({ opType, n }) => {
        const U = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const def = U.getUserDef(opType);
        const params = U.defaultParams(def);
        const children = builderOf(opType)(params);
        return { type: 'op', opType, id: `op_${opType}_${n}`, params, children };
    }, { opType, n });
}

async function loadAndBoot(page, opTypes) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsLoadBlockStack);
    await page.evaluate(() => window.showApp('studio'));
    const blocks = [];
    for (let i = 0; i < opTypes.length; i++) blocks.push(await mkOp(page, opTypes[i], i + 1));
    await page.evaluate((s) => window.ddcsLoadBlockStack(s), blocks);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => document.getElementById('blk-preview-panel') && document.getElementById('blk-preview-panel').__panel, null, { timeout: 8000 });
    await page.evaluate(() => document.getElementById('blk-preview-panel').__panel.setView('3d'));
    await page.waitForFunction(() => { const p = document.getElementById('blk-preview-panel').__panel; return p && p.viz; }, null, { timeout: 8000 });
    await page.waitForTimeout(300);
}

/** TEST-ONLY: strip the ONE intermediate M30 so a stepped run can cross the op boundary — see the header note.
 *  Not a source change; mutates the shared live projection object in place, exactly like a hand-edited .nc file
 *  loaded for this one test session would. */
async function stripIntermediateM30(page) {
    return page.evaluate(async () => {
        const { getProjection } = await import('/blocks/programModel.js');
        const proj = getProjection();
        const lines = proj.text.split('\n');
        const idx = lines.findIndex((l) => /^M30\b/.test(l.trim()));
        if (idx < 0) return false;
        lines.splice(idx, 1);
        proj.text = lines.join('\n');
        return true;
    });
}

async function stepOnce(page) {
    await page.evaluate(() => document.querySelector('#blk-preview-panel .pp-step').click());
    return page.evaluate(() => {
        const v = document.getElementById('blk-preview-panel').__panel.viz;
        return { hidden: !!v._playFrameStockHidden, chipFrame: v._posChipVal ? v._posChipVal.frame : null };
    });
}

test('PRIMARY EVIDENCE: the workpiece hides through every Homing line and reappears at Corner\'s own first line', async ({ page }) => {
    test.setTimeout(90_000);
    await loadAndBoot(page, ['user_homing_data', 'user_corner_data']);
    const stripped = await stripIntermediateM30(page);
    expect(stripped, 'sanity: the test-only M30 strip must find the boundary to work around').toBe(true);

    const trail = [];
    for (let i = 0; i < 40; i++) trail.push(await stepOnce(page));

    const hiddenFlags = trail.map((t) => t.hidden);
    // lines 1-31 (all of Homing's own emit) must be hidden; line 32 onward (Corner) must not be.
    const homingSpan = hiddenFlags.slice(0, 31);
    const cornerSpan = hiddenFlags.slice(32);
    expect(homingSpan.every(Boolean), `every line of Homing's own emit must hide the stock — got ${JSON.stringify(hiddenFlags)}`).toBe(true);
    expect(cornerSpan.length, 'sanity: stepped far enough into Corner to observe its own span').toBeGreaterThan(0);
    expect(cornerSpan.every((h) => h === false), `every line reached inside Corner's own emit must show the stock — got ${JSON.stringify(hiddenFlags)}`).toBe(true);
});

test('the DRO chip reads the per-line override, not just the whole-trace union: work → mach at Homing\'s own first real motion', async ({ page }) => {
    test.setTimeout(60_000);
    await loadAndBoot(page, ['user_homing_data', 'user_corner_data']);
    await stripIntermediateM30(page);

    const trail = [];
    for (let i = 0; i < 6; i++) trail.push(await stepOnce(page));
    const chipSeq = trail.map((t) => t.chipFrame);
    const firstMachIdx = chipSeq.indexOf('mach');
    expect(firstMachIdx, `the chip must flip to 'mach' once Homing's own first real motion (G31, line 4) commits — got ${JSON.stringify(chipSeq)}`).toBeGreaterThanOrEqual(0);
    expect(chipSeq.slice(firstMachIdx).every((f) => f === 'mach'), 'once mach, stays mach through the rest of the observed Homing span').toBe(true);
});

test('STOP resets to the idle picture: the play-frame flag clears, no separate freeze state', async ({ page }) => {
    test.setTimeout(60_000);
    await loadAndBoot(page, ['user_homing_data', 'user_corner_data']);
    await stripIntermediateM30(page);
    for (let i = 0; i < 5; i++) await stepOnce(page);   // land mid-Homing, own segment hidden
    const midRun = await page.evaluate(() => !!document.getElementById('blk-preview-panel').__panel.viz._playFrameStockHidden);
    expect(midRun, 'sanity: actually hidden mid-Homing before stopping').toBe(true);

    await page.evaluate(() => document.getElementById('blk-preview-panel').__panel.stop());
    const afterStop = await page.evaluate(() => !!document.getElementById('blk-preview-panel').__panel.viz._playFrameStockHidden);
    expect(afterStop, 'STOP must clear the play-frame flag — the idle picture is never left mid-hide').toBe(false);
});

test('the idle picture (before any play) is unaffected: the workpiece renders exactly as it does today', async ({ page }) => {
    test.setTimeout(60_000);
    await loadAndBoot(page, ['user_homing_data', 'user_corner_data']);
    const idle = await page.evaluate(() => {
        const v = document.getElementById('blk-preview-panel').__panel.viz;
        return { hasStockMesh: !!v.stockMesh, playFrameHidden: !!v._playFrameStockHidden };
    });
    expect(idle.hasStockMesh, 'the idle picture still builds the stock mesh (Bug 2\'s own simConfig()-null concern is a SEPARATE, narrower thing — confirmed by reading, not this slice\'s to touch').toBe(true);
    expect(idle.playFrameHidden, 'the new flag starts false — nothing hides the idle picture').toBe(false);
});
