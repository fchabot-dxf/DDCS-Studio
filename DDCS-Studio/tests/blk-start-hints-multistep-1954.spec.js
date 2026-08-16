import { test, expect } from '@playwright/test';
import { stopLiveSim, dismissToasts } from './support/simControls.js';

/**
 * t1954 — the SIXTH site of the t1928 bug. `blocksApp.js`'s own `blkStartHints` walked the RAW top-level stack
 * (`getStack()`), so a `multi_step` import wrapper (built by `importMarkedNc`, t1916) — which has no entry in
 * `opSimStarts`'s registry — contributed ZERO hints, and its wrapped children's own hints never appeared at all.
 * Every other "what operations does this program hold" site (setup sheet, time estimate, editor sim hints,
 * program-intent detection) already reads `flattenOps` (`programModel.js:109`), the ONE declared enumeration that
 * sees inside a `multi_step` wrapper; `blkStartHints` was the one site still walking the raw stack.
 *
 * Proven by COMPARISON, mirroring `marker-rebuild-1848`'s own "assert the outcome, not the internal array"
 * standard: a real Homing+Corner program loaded UNWRAPPED (2 top-level ops) is the known-good baseline (already
 * proven live by `marker-rebuild-1848`). The SAME program, round-tripped through export→import so it loads as a
 * SINGLE `multi_step` wrapper (the exact shape `importMarkedNc` produces — `multi-op-import-1916.spec.js`'s own
 * proven structure), must produce the IDENTICAL declared pass-start count and positions. Before the fix, the
 * wrapped case produced 0 hints (the wrapper itself has no registry entry); after, it matches the unwrapped
 * baseline exactly.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

async function clickNow(page, selector) {
    await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.click();
    }, selector);
}

// Same params as marker-rebuild-1848.spec.js, for direct comparability with its own already-proven baseline.
const HOMING_PARAMS = { run_z: true, run_x: true, run_y: true, run_a: false, run_b: false, softLimits: true };
const CORNER_PARAMS = { corner: 'FL', probeSeq: 'YX', travelDist: 50, safeZ: 10, scanDepth: 5, clearMode: 'hop', hopDist: 15, planeZ: 10, probeZFirst: false, travelApproach: 'auto', travelShape: 'dogleg', wcs: 'active', syncA: false, dist: 741, retract: 5, f_fast: 200, f_slow: 50, port: 3, radius: 2 };

async function switchToWholeProgram3D(page) {
    await stopLiveSim(page, '#blk_userViz3dBox');
    await dismissToasts(page);
    await clickNow(page, '.blk-view-btn[data-view="3d"]');
    await page.waitForFunction(() => {
        const host = document.getElementById('blk-preview-panel');
        const panel = host && host.__panel;
        return !!(panel && panel.getPassStarts && panel.getPassStarts().length);
    }, null, { timeout: 10000 });
    await stopLiveSim(page, '#blk-preview-panel');
}

function readPassStarts(page) {
    return page.evaluate(() => {
        const host = document.getElementById('blk-preview-panel');
        const panel = host && host.__panel;
        const starts = panel && panel.getPassStarts ? panel.getPassStarts() : null;
        return (starts || []).map((s) => ({ x: s.x, y: s.y, z: s.z }));
    });
}

test('a multi_step-wrapped program (importMarkedNc shape) gets the SAME declared pass starts as its unwrapped source', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    // 1) UNWRAPPED baseline — two top-level ops, the already-proven-correct shape (marker-rebuild-1848).
    await page.evaluate(async ({ homingParams, cornerParams }) => {
        const OB = await import('/blocks/opBuilders.js');
        const homingOp = OB.makeOp('user_homing_data', homingParams, OB._builderAtoms('user_homing_data', homingParams));
        const cornerOp = OB.makeOp('user_corner_data', cornerParams, OB._builderAtoms('user_corner_data', cornerParams));
        window.ddcsLoadBlockStack([homingOp, cornerOp]);
    }, { homingParams: HOMING_PARAMS, cornerParams: CORNER_PARAMS });
    await page.waitForFunction(() => window.ddcsGetBlockProgram().filter((b) => b.type === 'op').length === 2, null, { timeout: 10000 });
    await clickNow(page, '[data-app="blocks"]');
    await page.waitForFunction(() => window.__blkws, null, { timeout: 10000 });
    await page.waitForTimeout(1500);
    await switchToWholeProgram3D(page);
    const unwrapped = await readPassStarts(page);

    // 2) Export the unwrapped program WITH markers, then import it back — the real importMarkedNc round-trip
    //    (multi-op-import-1916.spec.js's own proven structure), producing ONE top-level multi_step wrapper.
    const wrapperTopLevel = await page.evaluate(async () => {
        const exported = window.ddcsSerializeWithMarkers();
        const progMod = await import('/blocks/programModel.js');
        const imported = progMod.importMarkedNc(exported);
        window.ddcsLoadBlockStack(imported);
        return imported.map((b) => ({ type: b && b.type, opType: b && b.opType }));
    });
    const ops = wrapperTopLevel.filter((b) => b.type === 'op');
    expect(ops.length, 'sanity: the round-trip produced exactly one top-level op').toBe(1);
    expect(ops[0].opType, 'sanity: it is the multi_step wrapper, not two loose ops').toBe('multi_step');

    await page.waitForFunction(() => {
        const p = window.ddcsGetBlockProgram().filter((b) => b && b.type === 'op');
        return p.length === 1 && p[0].opType === 'multi_step';
    }, null, { timeout: 10000 });
    await switchToWholeProgram3D(page);
    const wrapped = await readPassStarts(page);

    // THE OUTCOME: wrapping the SAME program in a multi_step step-holder must not change what the Blocks-tab sim
    // shows the operator — same count, same positions, not one hint (the wrapper) and not zero.
    expect(unwrapped.length, 'sanity: the unwrapped baseline declares more than one pass start').toBeGreaterThan(1);
    expect(wrapped.length, 'the wrapped program declares the SAME number of pass starts as its unwrapped source').toBe(unwrapped.length);
    for (let i = 0; i < unwrapped.length; i++) {
        expect(Math.abs(wrapped[i].x - unwrapped[i].x), `pass ${i}'s X matches the unwrapped baseline`).toBeLessThan(1);
        expect(Math.abs(wrapped[i].y - unwrapped[i].y), `pass ${i}'s Y matches the unwrapped baseline`).toBeLessThan(1);
    }
});
