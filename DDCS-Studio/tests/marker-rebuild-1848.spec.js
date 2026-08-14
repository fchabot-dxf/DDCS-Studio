import { test, expect } from '@playwright/test';
import { openWizardViaBar, clickInsert, fillField } from './support/barGesture.js';

/**
 * t1848 — the last of the three t1786 trace bugs (WORK-LOG t1786→t1826 confirm/cross-check, re-measured unmoved
 * FOUR times since across the bug1/bug2 fix chain): "the 3D marker array never rebuilds for a later op." OBSERVED
 * as `panel.viz.spindleMarkers.length` stuck at 1 for a Homing+Corner program that declares 3 real pass starts.
 *
 * Asserts the OUTCOME, not the internal array: the whole-program 3D preview's own marker sprites must match the
 * program's own DECLARED pass starts (`getPassStarts()`), both in COUNT and in POSITION — not merely that
 * SOMETHING got reassigned. Confirmed by direct screenshot (`verification/t1848-bug3-initial.png`) that this is
 * a real, user-visible defect: switching to the Blocks tab's own 3D view after Homing+Corner shows only ONE
 * position readout near Homing's own start — nothing marks where Corner's own two walls will be probed.
 *
 * DIAGNOSED (not fixed) at t1848 — a NAME MISMATCH, bug 1's own family: "pass count" means two different things.
 * `createPreviewPanel.js`'s own `setGcode` (:888) computes `passStarts` via `computePassStarts()` — the DECLARED,
 * correct, per-op-concatenated count (3 for Homing+Corner) — and correctly feeds it to the 2D sibling
 * (`t2.setStarts(passStarts)`, :935). But the 3D `viz`'s own rebuild trigger, `setSegments(parsed, fit)`
 * (`gcodeViz3d.js:1048-1050`), is called WITHOUT `passStarts` (`v.setSegments(parsed, !fitted)`,
 * `createPreviewPanel.js:996`) — it derives `_passCount` entirely from `parsed.stats.passes`
 * (`GcodeExecutionEngine.js:300,464`), a DIFFERENT, narrower concept: a count of `REPOSITION:` COMMENT boundaries
 * crossed during trace EXECUTION, not of declared pass starts. Homing emits no `REPOSITION:` comment (it is not
 * a multi-pass op in that sense), so the trace never sees a boundary before Corner's own first wall — from the
 * trace's own perspective Homing + Corner's wall1 are ONE undivided pass, and only Corner's own wall1→wall2
 * boundary (ONE `REPOSITION:` comment) is ever counted. Measured directly: `stats.passes` computes to 2 for this
 * program (not 3, and not the observed 1 either — `_ensureMarkers()`'s own guard,
 * `if (spindleMarkers.length === this._passCount) return`, means once `_passCount` and `markers.length` agree on
 * a STALE 1 — set by Homing's own SOLO first render, before Corner ever existed, when `stats.passes` was
 * legitimately 1 — they never diverge again to trigger a rebuild, even though `_passCount` itself SHOULD have
 * become 2 on the next `setSegments` call). `_ensureMarkers()`'s own rebuild-skip guard is not the root cause;
 * it is working exactly as designed against a `_passCount` fed from the wrong source in the first place — the
 * SAME shape as bug 1's own `_framed()` gap (a naming/routing mismatch one layer above the visible symptom, not
 * the layer where the symptom appears).
 *
 * FIXED at t1850, after enumerating every `_passCount` consumer in `gcodeViz3d.js` first (per the dispatch's own
 * explicit warning: the first `_framed()` fix went wrong by being right about the cause and too broad in the
 * remedy). Three consumers found:
 *   (a) `_ensureMarkers()` — the marker-rebuild trigger. Wants the DECLARED count. FIXED: rebuilds to
 *       `Math.max(this._passCount, this.starts.length)`, never smaller than either source (keeps
 *       `marker-colour-by-source.spec.js`'s own direct `_passCount=3` manipulation working, since it never
 *       touches `starts`).
 *   (b) `setSegments()`'s own `this.starts` sizing — previously grew AND TRUNCATED to `_passCount`, silently
 *       discarding real, already-correct entries `setStarts()` had just set. FIXED: grow-only, truncation
 *       removed.
 *   (c) `_rebuild()`'s own per-pass route-drawing loop (`byPass[p]`, grouping ACTUAL TRACED SEGMENTS by the
 *       trace's own per-segment `.pass` index) and the SAME loop's `_dataBounds` (read by `fitAll()` for camera
 *       framing) — LEFT UNCHANGED. This consumer genuinely needs the trace-derived count: `byPass` is keyed by
 *       the trace engine's own pass index, which has no declared-count equivalent without deeper trace-engine
 *       work. NAMED, not fixed, per the dispatch's own "if it makes stats.passes look wrong for its OWN
 *       consumers, do not fix that here" instruction — `fitAll()`'s camera-fit inherits this same limitation
 *       (confirmed: a manual `viz.fit()` computed from the correct `viz.starts` still requires `stopLiveSim()`
 *       first, `tests/support/simControls.js`, to see past the panel's own default autoplay/loop — a separate,
 *       pre-existing interaction, not this bug).
 *
 * `createPreviewPanel.js`'s own pre-existing per-index sync loop (which already, correctly, grew `v.starts` to
 * the declared length via direct array-index assignment) is replaced by a new `v.setStarts(passStarts)` method
 * on `GcodeViz3D`, mirroring `t2.setStarts(passStarts)` — the 2D view's identical, already-proven seam — one
 * call site instead of two near-duplicate blocks, same t94 `anchorsAtPrev` + t301 `pinned` fidelity preserved.
 * Non-vacuous: reverting both files (`git checkout HEAD --`) fails both tests below 2/2 (6/6 across Playwright's
 * own retries) with `markerCount: 1` where `3`/`5` was expected; restoring passes 2/2.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

async function buildHomingThenCorner(page) {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await openWizardViaBar(page, { group: 'Probe', optype: 'homing' });
    await clickInsert(page);
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });
    await openWizardViaBar(page, { group: 'Probe', optype: 'corner' });
    await fillField(page, { formSelector: '#wiz_user_form', param: 'dist', value: '741' });
    await clickInsert(page);
    await page.waitForFunction(() => window.ddcsGetBlockProgram().filter((b) => b.type === 'op').length >= 2, null, { timeout: 10000 });
    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => window.__blkws, null, { timeout: 10000 });
    await page.waitForTimeout(1500);
    // Inserting an op auto-selects it for editing (the Wizard view), which collapses #blk-preview-panel to 0x0
    // (styles.css:5416, confirmed by direct measurement) — switch to the Blocks tab's own 3D view to see the
    // whole-program preview this bug is actually about.
    await page.locator('.blk-view-btn[data-view="3d"]').click({ force: true, noWaitAfter: true });
    await page.waitForTimeout(800);
}

function readMarkers(page) {
    return page.evaluate(() => {
        const host = document.getElementById('blk-preview-panel');
        const panel = host && host.__panel;
        const starts = panel && panel.getPassStarts ? panel.getPassStarts() : null;
        const markers = panel && panel.viz && panel.viz.spindleMarkers;
        return {
            hasPanel: !!panel,
            passStarts: starts,
            markerCount: markers ? markers.length : -1,
            markerPositions: markers ? markers.map((m) => (m.position ? { x: m.position.x, y: m.position.y } : null)) : null,
        };
    });
}

test('the whole-program 3D preview marks EVERY declared pass start, count and position, for a real Homing+Corner program', async ({ page }) => {
    test.setTimeout(60_000);
    await buildHomingThenCorner(page);
    const r = await readMarkers(page);

    expect(r.hasPanel, 'sanity: the whole-program preview panel exists').toBe(true);
    expect(r.passStarts.length, 'sanity: the program genuinely declares 3 pass starts (homing + corner\'s 2 walls)').toBe(3);

    // THE OUTCOME: a marker sprite for every declared pass, not just the first.
    expect(r.markerCount, 'the 3D preview marks all 3 declared passes, not just the first').toBe(r.passStarts.length);

    // AND at the right positions, not just the right count (XY only — the marker sprite floats at a fixed Z
    // offset above the tool position by convention, confirmed by direct measurement, so Z is not compared here).
    for (let i = 0; i < r.passStarts.length; i++) {
        const want = r.passStarts[i];
        const got = r.markerPositions[i];
        expect(got, `marker ${i} exists at all`).not.toBeNull();
        expect(Math.abs(got.x - want.x), `marker ${i}'s own X matches its declared pass start`).toBeLessThan(1);
        expect(Math.abs(got.y - want.y), `marker ${i}'s own Y matches its declared pass start`).toBeLessThan(1);
    }
});

test('the markers REBUILD when a param change alters the declared pass starts (not frozen from first render)', async ({ page }) => {
    test.setTimeout(60_000);
    await buildHomingThenCorner(page);
    const before = await readMarkers(page);

    // Change the declared pass starts via the real, common "insert another pass" gesture (a second Corner probe,
    // a genuinely different set of declared pass starts the panel must pick up) rather than an in-place field
    // edit — simpler and equally real: a user adding a second probe to their program. Switch back to Studio
    // first — the top command bar's own dropdown is not reliably clickable from inside the Blocks tab at all
    // (confirmed: the bar gesture times out from either of its own Wizard/3D sub-views).
    await page.locator('[data-app="studio"]').click();
    await page.waitForTimeout(300);
    await openWizardViaBar(page, { group: 'Probe', optype: 'corner' });
    await fillField(page, { formSelector: '#wiz_user_form', param: 'dist', value: '900' });
    await clickInsert(page);
    await page.waitForFunction(() => window.ddcsGetBlockProgram().filter((b) => b.type === 'op').length >= 3, null, { timeout: 10000 });
    await page.locator('[data-app="blocks"]').click();
    await page.waitForTimeout(500);
    await page.locator('.blk-view-btn[data-view="3d"]').click({ force: true, noWaitAfter: true });
    await page.waitForTimeout(800);

    const after = await readMarkers(page);
    expect(after.passStarts.length, 'the program now declares MORE pass starts (homing + 2 corners x 2 walls)').toBeGreaterThan(before.passStarts.length);
    expect(after.markerCount, 'the marker count REBUILT to match the new, larger pass-start count').toBe(after.passStarts.length);
});
