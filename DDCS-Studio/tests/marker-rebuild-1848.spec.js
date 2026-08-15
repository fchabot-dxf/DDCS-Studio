import { test, expect } from '@playwright/test';
import { stopLiveSim, dismissToasts } from './support/simControls.js';

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
 *
 * STABILISED at t1852 — this file itself was flaky under a real load batch (the advisor's own full suite, and
 * separately a 56-spec gate run here), three rounds of causal investigation, each one proven or disproven by an
 * actual load-batch re-run rather than assumed:
 *   ROUND 1: stopped the Blocks pane's Wizard-view preview (`#blk_userViz3dBox`, autoplay-loops the moment the
 *     auto-selected op mounts it — t1818's own established mechanism) before the 3D-toggle click, and replaced a
 *     fixed post-click `waitForTimeout(800)` with a poll for the rebuild's own observable completion
 *     (`setActiveTab`'s `setTimeout(fn, 60)` deferral is the only real async boundary — its own body,
 *     `refresh = () => setGcode()`, is synchronous, so guessing its duration under load was always a race).
 *   ROUND 2: a load-batch "before" run instead failed on the LATER `[data-app="studio"]` click — the
 *     whole-program preview (`#blk-preview-panel`, confirmed autoplay-looping at t1850's own screenshot
 *     investigation) was left running too, so ANY later click could race EITHER panel's own animation, not just
 *     the one Round 1 addressed. Stopped that sim too, right after mounting.
 *   ROUND 3: a further load-batch re-run STILL failed, on the SAME `.blk-view-btn[data-view="3d"]` click, with
 *   NOTHING left animating in the page. The real bottleneck: Playwright's own input-dispatch pipeline (mouse
 *   hit-testing + a CDP round-trip) needs the page's main thread free to service it, and under this batch OTHER
 *   WORKERS' own Chromium instances are themselves doing heavy WebGL work — genuine, external, cross-process
 *   contention no amount of stopping THIS page's own animations can fully absorb. Fixed by routing every
 *   tab/view-switch click through `clickNow()`, a direct `page.evaluate(() => el.click())` DOM call — the SAME
 *   mechanism `stopLiveSim`/`dismissToasts` (this file's own imports) already use — which dispatches a real
 *   'click' Event to the same listeners without needing the browser's separate input-event pipeline.
 * Proved under the SAME load batch throughout, not isolation alone: see WORK-LOG t1852 for the full run log.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

// t1852 (round 3, after a load-batch re-run STILL failed on this exact click even with the Wizard-view sim
// stopped first) — the real bottleneck is Playwright's own input-dispatch pipeline (mouse hit-testing + a CDP
// round-trip through `Input.dispatchMouseEvent`), which needs the target page's main thread free to service it;
// under a 4-worker batch where OTHER workers' own Chromium instances are simultaneously doing heavy WebGL work
// (several sibling specs in this exact batch literally assert "the 3D preview PLAYS"), that round-trip can
// exceed 5000ms even with `force:true` (which only skips the actionability wait, not the dispatch itself) and
// even with nothing left animating in THIS page. This is genuine, external, cross-process CPU/GPU contention,
// not a race this test's own state can resolve by waiting differently. `stopLiveSim`/`dismissToasts` (this same
// file, `tests/support/simControls.js`) already sidestep the SAME pipeline for their own DOM actions via
// `page.evaluate(() => el.click())` — a synchronous in-page DOM method call that still dispatches a real 'click'
// Event to the SAME listeners (`blocksApp.js`'s own `addEventListener('click', ...)`, `showApp`'s own
// `onclick=""`) without needing the browser's separate input-event pipeline. Extending that established, already
// -proven mechanism to every tab/view-switch click in this file — not just the ones already observed failing —
// since the underlying hazard (this pipeline, under this batch's contention) applies uniformly to all of them.
async function clickNow(page, selector) {
    await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.click();
    }, selector);
}

// t1920 — FIXTURE CHANGED, claim unchanged. A real bar-gesture Insert now REPLACES the program (t1916/t1918/
// t1920's own ruling: a Studio-canvas program is always exactly one op) — two live inserts can no longer produce
// a 2-op program at all. Built directly instead, via the SAME production functions the (deleted) accumulation
// path used to call (`opBuilders.js`'s own `makeOp`/`_builderAtoms`), matching `prog-marker-slot-812.spec.js`'s
// own established hand-built-fixture pattern. This test's own claim (`getPassStarts()`/the 3D marker rebuild)
// operates on the WHOLE PROGRAM's own concatenated G-code/trace, not on per-op `opAtLine` resolution — so, unlike
// `segment-frame-derivation-1838.spec.js`, it does not matter here whether the two ops are top-level siblings or
// nested; two top-level ops were chosen for consistency with that file and because `blockEmitter.js`'s transparent
// op-in-op recursion (confirmed t1916) makes the emitted G-code identical either way. Params captured from a real
// single-op live insert (homing's own shipped defaults; corner's own shipped defaults with `dist:741`).
const HOMING_PARAMS = { run_z: true, run_x: true, run_y: true, run_a: false, run_b: false, softLimits: true };
const CORNER_PARAMS = { corner: 'FL', probeSeq: 'YX', travelDist: 50, safeZ: 10, scanDepth: 5, clearMode: 'hop', hopDist: 15, planeZ: 10, probeZFirst: false, travelApproach: 'auto', travelShape: 'dogleg', wcs: 'active', syncA: false, dist: 741, retract: 5, f_fast: 200, f_slow: 50, port: 3, radius: 2 };
const CORNER2_PARAMS = { ...CORNER_PARAMS, dist: 900 };   // a second, genuinely different corner — matches the old test's own second-insert dist

async function loadStack(page, ops) {
    await page.evaluate(async (opDefs) => {
        const OB = await import('/blocks/opBuilders.js');
        const built = opDefs.map(({ opType, params }) => OB.makeOp(opType, params, OB._builderAtoms(opType, params)));
        window.ddcsLoadBlockStack(built);
    }, ops);
    await page.waitForFunction((n) => window.ddcsGetBlockProgram().filter((b) => b.type === 'op').length === n, ops.length, { timeout: 10000 });
}

async function buildHomingThenCorner(page) {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await loadStack(page, [{ opType: 'user_homing_data', params: HOMING_PARAMS }, { opType: 'user_corner_data', params: CORNER_PARAMS }]);
    await clickNow(page, '[data-app="blocks"]');
    await page.waitForFunction(() => window.__blkws, null, { timeout: 10000 });
    await page.waitForTimeout(1500);
    // A directly-loaded stack has no "active op" to auto-select, so the Wizard-view's own autoplay concern
    // (t1852's own round 1) does not apply here — but switch to the Blocks tab's own 3D view the same way,
    // since that is still the whole-program preview this bug is about.
    await switchToWholeProgram3D(page);
}

// t1852 — the Wizard-view's own per-op preview (`#blk_userViz3dBox`) autoplay-loops the instant the auto-
// selected op mounts it (t1818's own established finding, same mechanism as pane-surface-scroll-1766's own
// fix) — under a real load batch this genuinely starved the very next actionability-checked click (the 3D-
// toggle button) of main-thread cycles long enough to exceed Playwright's own 5000ms click-dispatch timeout,
// reproduced directly: `locator('.blk-view-btn[data-view="3d"]').click()` timing out mid-dispatch (element
// already resolved, so not a missing-element issue) under a 4-worker/56-spec batch, isolation always clean.
// Stopping the still-running Wizard-view sim BEFORE this click — the same convention every sibling Blocks-pane
// spec already uses — removes the contention rather than widening the click's own timeout.
async function switchToWholeProgram3D(page) {
    await stopLiveSim(page, '#blk_userViz3dBox');
    await dismissToasts(page);
    await clickNow(page, '.blk-view-btn[data-view="3d"]');
    // t1852 — `setActiveTab('3d')` defers its own mount/rebuild via `setTimeout(fn, 60)` (blocksApp.js:447),
    // whose body (`panel.setActive(true); panel.refresh()`) is SYNCHRONOUS once it fires (`refresh = () =>
    // setGcode()`, createPreviewPanel.js:1060) — the only real async boundary is that one deferred callback, not
    // an indeterminate render pipeline. A fixed `waitForTimeout` after the click races that boundary under load
    // (a busy main thread can delay a scheduled timer well past its nominal 60ms); polling for the rebuild's own
    // observable effect — the marker count converging on the declared pass-start count — waits for the REAL
    // event instead of guessing its duration. Not circular: if the rebuild genuinely regressed, this times out
    // (10s) and the subsequent read+assert below still fails, honestly, just after the wait exhausts rather than
    // immediately — it cannot mask a real defect, only stop a slow-but-correct settle from reading as one.
    await page.waitForFunction(() => {
        const host = document.getElementById('blk-preview-panel');
        const panel = host && host.__panel;
        const starts = panel && panel.getPassStarts && panel.getPassStarts();
        const markers = panel && panel.viz && panel.viz.spindleMarkers;
        return !!(starts && markers && markers.length === starts.length);
    }, null, { timeout: 10000 });
    // t1852 (round 2, after a load-batch "before" run caught this) — the whole-program panel we just mounted
    // ALSO autoplay-loops by default (confirmed t1850's own screenshot investigation), and is left running for
    // the rest of the caller's own test unless stopped here — a LATER click (e.g. switching back to the Studio
    // tab) can just as easily race THIS panel's own ongoing animation as the Wizard-view's. Stopping only the
    // Wizard-view's sim before THIS click was too narrow: it fixed the first click, not the general cause.
    await stopLiveSim(page, '#blk-preview-panel');
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

    // t1920 — Change the declared pass starts by loading a DIFFERENT program (homing + TWO corners — a genuinely
    // different, larger set of declared pass starts the panel must pick up), replacing the "insert another pass"
    // live gesture the old test used — a real bar-gesture Insert now REPLACES rather than adds a THIRD op (see
    // this file's own top comment). Same underlying claim: the program changed, the markers must not stay frozen
    // from the first render.
    await clickNow(page, '[data-app="studio"]');
    await page.waitForTimeout(300);
    await loadStack(page, [
        { opType: 'user_homing_data', params: HOMING_PARAMS },
        { opType: 'user_corner_data', params: CORNER_PARAMS },
        { opType: 'user_corner_data', params: CORNER2_PARAMS },
    ]);
    await clickNow(page, '[data-app="blocks"]');
    await page.waitForTimeout(500);
    await switchToWholeProgram3D(page);

    const after = await readMarkers(page);
    expect(after.passStarts.length, 'the program now declares MORE pass starts (homing + 2 corners x 2 walls)').toBeGreaterThan(before.passStarts.length);
    expect(after.markerCount, 'the marker count REBUILT to match the new, larger pass-start count').toBe(after.passStarts.length);
});
