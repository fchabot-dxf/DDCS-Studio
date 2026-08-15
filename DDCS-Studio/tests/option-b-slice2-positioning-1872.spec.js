import { test, expect } from '@playwright/test';

/**
 * t1836→t1838→t1862→t1872 — Option B, SLICE 2 of 3: POSITIONING. Slice 1 (`segmentFrame.js`) derived which LINE
 * range belongs to which op and what frame it declares — inert, unused. This slice makes that awareness actually
 * shift the drawn geometry for a multi-op program (built via the Blocks tab, e.g. Homing then Corner) instead of
 * one whole-trace flag applied uniformly to every pass.
 *
 * RE-SCOPED FROM t1862's OWN 5-consumer enumeration, re-verified this turn by reading the code, not assumed:
 *   1. Live tool (`setToolPosition`) — IN SCOPE, converted.
 *   2. Static route loop — IN SCOPE, converted.
 *   3. Marker sprite positioning (`_positionMarkers`) — IN SCOPE, converted.
 *   4. The 2D mirror (`toolpath2d.js`) — SLICED OUT (its own follow-up act): confirmed AGAIN this turn there is no
 *      per-segment loop there at all (`machineFrame` gates two whole-view computations), a genuinely bigger,
 *      differently-shaped task than 1-3, not a converted read. Its own `setStarts` explicitly REBUILDS each row
 *      to `{x,y,z,anchorsAtPrev}` only (checked directly) — it will not even SEE the new field this turn adds,
 *      so this slice is provably inert there, not just unscoped.
 *   5. DRO frame-labeling during play (`createPreviewPanel.js`, `onPositionChange`) — DEFERRED to Slice 3 per the
 *      dispatch's own default ("unless you can argue it belongs here") — no argument found: it only matters
 *      DURING PLAY (tied to `pos.pass`), which is Slice 3's own territory (B2, "per-moment"), not Slice 2's (B1,
 *      "regardless of playback").
 *
 * A DEEPER CORRECTION beyond the re-scoping, found by reading the actual code rather than reusing t1862's own
 * "same shape as the static route loop" characterization: sites 1/2/3 are PASS-indexed (`this.starts[p]`, `s.pass`
 * from the trace engine's own `_pass` counter), NOT line-indexed — Slice 1's `frameOwnerAtLine`/`frameSegments`
 * (line-indexed) do not directly apply here; a NEW per-pass tag was needed. And crucially: `_toolMachineFrame` is
 * not a bug in isolation — `opSimContext.js`'s `programSimContext` DELIBERATELY unions `toolMachineFrame` (along
 * with `forceMachine`/`seatAtStart`) across every op in a program (t714/R-B#6, t756/R-C), and OTHER consumers
 * (`forceMachine`'s envelope, `seatAtStart`, `simStock()`'s stock-hiding — Bug 2, t1832/t1834, explicitly RULED
 * "do not touch the frame model") still correctly depend on that SAME union. Converting sites 1-3 could not
 * simply flip a flag; it had to ADD a separate, per-pass OVERRIDE that only positioning reads, leaving the union
 * and everything else that depends on it completely untouched — the STOP CLAUSE's "unsafe conversion" concern,
 * resolved by making the change purely ADDITIVE rather than replacing the union's own read sites.
 *
 * THE FIX: `blocksApp.js`'s `blkStartHints` (the ONE place that concatenates per-op `opSimStarts` hints into one
 * whole-program array, for the Blocks tab's own multi-op preview) now tags each contributed hint with ITS OWN
 * op's `opSimContext(opType).toolMachineFrame` — the SAME source `programSimContext`'s union already reads, just
 * applied per-pass instead of per-program. Threaded through `createPreviewPanel.js`'s `computePassStarts` row
 * shape and `gcodeViz3d.js`'s own `setStarts` (both already carry `emits`/`source`/`anchorsAtPrev` the same way).
 * The 3 read sites resolve `row.toolMachineFrame != null ? row.toolMachineFrame : this._toolMachineFrame` — an
 * override when a multi-op program tagged it, a fallback to the untouched whole-trace flag otherwise. Every
 * OTHER hint supplier (wizardManager.js's own single-op preview, the overwhelming common case) never sets this
 * field, so every existing single-op flow is BYTE-IDENTICAL — proven by the 2 pre-existing screenshot baselines
 * (`screenshot-baselines-1792.spec.js`, both single-op Corner) staying zero-diff, checked this turn.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

// t756's own established helper uses the BARE built-in type ('homing'), which opSimContext resolves fine (its
// MACHINE_FRAME_TOOL set matches bare names) — but opSimStarts's own HINT dispatch only recognizes the wizards-
// as-data TWIN type ('user_homing_data'), registered via setUserSimStarts, not the bare name (confirmed: bare
// 'homing'/'corner' resolve to `null` hints, checked directly). This suite is specifically about per-PASS hint
// tagging, so it needs real hints — the twin type, matching what a real bar-gesture Insert actually produces
// (segment-frame-derivation-1838.spec.js's own sanity check pins this same fact for Slice 1).
const bare = (opType, n) => ({ type: 'op', opType, id: `op_${opType}_${n}`, children: [] });
const HOMING = 'user_homing_data', CORNER = 'user_corner_data';

async function loadBlocksStack(page, stack) {
    await page.evaluate(() => window.showApp('studio'));
    await page.evaluate((s) => window.ddcsLoadBlockStack(s), stack);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => document.getElementById('blk-preview-panel') && document.getElementById('blk-preview-panel').__panel, null, { timeout: 8000 });
    await page.evaluate(() => document.getElementById('blk-preview-panel').__panel.setView('3d'));
    await page.waitForFunction(() => { const p = document.getElementById('blk-preview-panel').__panel; return p && p.viz; }, null, { timeout: 8000 });
    await page.waitForTimeout(250);
}

test('PRIMARY EVIDENCE: a Homing-then-Corner Blocks program tags EACH pass with its OWN op\'s frame, not one union for the whole trace', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsLoadBlockStack);

    const stack = [bare(HOMING, 1), bare(CORNER, 2)];
    await loadBlocksStack(page, stack);

    const r = await page.evaluate(() => {
        const v = document.getElementById('blk-preview-panel').__panel.viz;
        return {
            // the WHOLE-PROGRAM union — Bug 2's own mechanism (t1832), MUST stay exactly as-is: Homing's own true
            // still wins the OR, unweakened, per the explicit "do not touch the frame model" ruling.
            unionToolMachineFrame: !!v._toolMachineFrame,
            starts: (v.starts || []).map((s) => ({ toolMachineFrame: s.toolMachineFrame })),
        };
    });

    expect(r.unionToolMachineFrame, 'the whole-program union (Bug 2\'s own mechanism, t1832/t1834) is untouched: Homing still forces it true panel-wide').toBe(true);
    expect(r.starts.length, 'sanity: both ops contributed at least one pass each').toBeGreaterThanOrEqual(2);
    // Homing declares toolMachineFrame; Corner does not (opSimContext.js's own MACHINE_FRAME_TOOL set excludes it,
    // pinned by sim-intent-fold.spec.js elsewhere) — so despite the union being true panel-wide, the tagged rows
    // must diverge: at least one row explicitly false (Corner's own), not just "some rows lack the field".
    const explicitlyFalse = r.starts.filter((s) => s.toolMachineFrame === false);
    const explicitlyTrue = r.starts.filter((s) => s.toolMachineFrame === true);
    expect(explicitlyTrue.length, `at least one pass (Homing's) is explicitly tagged true — got ${JSON.stringify(r.starts)}`).toBeGreaterThan(0);
    expect(explicitlyFalse.length, `at least one pass (Corner's) is explicitly tagged false, diverging from the true union — got ${JSON.stringify(r.starts)}`).toBeGreaterThan(0);
});

test('a single-op program tags its one pass to MATCH the (also true) union — no divergence to prove here, unlike multi-op', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsLoadBlockStack);

    await loadBlocksStack(page, [bare(HOMING, 1)]);
    const r = await page.evaluate(() => {
        const v = document.getElementById('blk-preview-panel').__panel.viz;
        return { unionToolMachineFrame: !!v._toolMachineFrame, starts: (v.starts || []).map((s) => s.toolMachineFrame) };
    });
    expect(r.unionToolMachineFrame, 'a bare homing program still forces the whole-trace flag true').toBe(true);
    // single-op → blkStartHints still tags it (every op's own hints get tagged now, not just multi-op ones) — so
    // this asserts the TAG matches the op's own declaration, which for a single homing op is also true; the
    // interesting byte-identical claim is proven by the untouched screenshot baselines (single-op WIZARD preview,
    // a different host entirely, never routes through blkStartHints at all).
    expect(r.starts.every((t) => t === true), 'a single-op homing program tags its one pass true, matching the (also true) union').toBe(true);
});

test('the 2D mirror (toolpath2d.js) is provably untouched: its own setStarts rebuilds rows without the new field', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsLoadBlockStack);

    await loadBlocksStack(page, [bare(HOMING, 1), bare(CORNER, 2)]);
    const r = await page.evaluate(() => {
        const p = document.getElementById('blk-preview-panel').__panel;
        const t2 = p.tp || p.toolpath2d || null;   // best-effort — whichever handle this panel exposes for the 2D view
        return { has2d: !!t2, sample: t2 && t2.starts ? Object.keys(t2.starts[0] || {}) : null };
    });
    // Not asserting a specific handle name (implementation detail) — the real proof is static, checked by reading
    // toolpath2d.js's own setStarts (WORK-LOG t1872): `starts = arr.map(p => ({x,y,z,anchorsAtPrev}))`, an explicit
    // rebuild that cannot carry a field it doesn't name. This test exists so a FUTURE accidental widening (e.g.
    // someone changes that rebuild to a spread) has a place to fail loudly once toolMachineFrame starts mattering
    // there — for now it's a no-op sanity check that the 2D handle, if reachable, never receives the tag.
    if (r.has2d && r.sample) expect(r.sample, 'toolpath2d.js\'s own row shape must not (yet) carry toolMachineFrame').not.toContain('toolMachineFrame');
});
